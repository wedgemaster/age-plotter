"""Query execution service with timeout and cancellation support."""

import asyncio
import json
import re
import time
from dataclasses import dataclass
from typing import Any

from neo4j import AsyncGraphDatabase, AsyncSession, Query
import psycopg
from psycopg import sql

from ..models.connection import (
    AgeConnection,
    ConnectionType,
    Neo4jConnection,
    StoredConnection,
)
from ..models.result import (
    GraphNode,
    GraphRelationship,
    QueryError,
    QueryResult,
)


@dataclass
class ExecutionContext:
    """Tracks a running query for cancellation."""

    session_id: str
    query_id: str
    # For Neo4j: the session
    neo4j_session: AsyncSession | None = None
    # For PostgreSQL: the connection and backend PID
    pg_conn: psycopg.AsyncConnection | None = None
    pg_pid: int | None = None
    cancelled: bool = False


# Global registry of running queries (session_id -> ExecutionContext)
_running_queries: dict[str, ExecutionContext] = {}


async def execute_query(
    connection: StoredConnection,
    query: str,
    timeout_ms: int,
    session_id: str,
    cypher_only: bool = False,  # For AGE: wrap query in cypher() call
) -> QueryResult | QueryError:
    """Execute query against the active connection."""
    query_id = f"{session_id}-{time.time()}"

    try:
        if connection.type == ConnectionType.NEO4J:
            return await _execute_neo4j(
                connection.config,  # type: ignore
                query,
                timeout_ms,
                session_id,
                query_id,
            )
        else:
            return await _execute_age(
                connection.config,  # type: ignore
                query,
                timeout_ms,
                session_id,
                query_id,
                cypher_only,
            )
    finally:
        _running_queries.pop(session_id, None)


async def cancel_query(session_id: str) -> bool:
    """Cancel a running query for the given session."""
    ctx = _running_queries.get(session_id)
    if not ctx:
        return False

    ctx.cancelled = True

    if ctx.neo4j_session:
        # Neo4j: close the session to cancel
        await ctx.neo4j_session.close()
        return True

    if ctx.pg_conn and ctx.pg_pid:
        # PostgreSQL: cancel via pg_cancel_backend
        try:
            # Need a separate connection to issue cancel
            async with await psycopg.AsyncConnection.connect(
                host=ctx.pg_conn.info.host,
                port=ctx.pg_conn.info.port,
                dbname=ctx.pg_conn.info.dbname,
                user=ctx.pg_conn.info.user,
                password=ctx.pg_conn.info.password,
            ) as cancel_conn:
                await cancel_conn.execute(
                    sql.SQL("SELECT pg_cancel_backend({})").format(sql.Literal(ctx.pg_pid))
                )
            return True
        except Exception:
            return False

    return False


async def _execute_neo4j(
    config: Neo4jConnection,
    query: str,
    timeout_ms: int,
    session_id: str,
    query_id: str,
) -> QueryResult | QueryError:
    """Execute Cypher query against Neo4j."""
    driver = AsyncGraphDatabase.driver(
        config.uri,
        auth=(config.username, config.password),
    )

    try:
        async with driver.session(database=config.database) as session:
            # Register for cancellation
            ctx = ExecutionContext(
                session_id=session_id,
                query_id=query_id,
                neo4j_session=session,
            )
            _running_queries[session_id] = ctx

            start = time.monotonic()

            try:
                # Execute with timeout
                # Note: query is user-provided, so we use type: ignore for LiteralString
                result = await asyncio.wait_for(
                    session.run(Query(query)),  # type: ignore[arg-type]
                    timeout=timeout_ms / 1000,
                )
                # Use to_eager_result() to get all records while preserving Node/Relationship types
                eager_result = await asyncio.wait_for(
                    result.to_eager_result(),
                    timeout=timeout_ms / 1000,
                )
                # Convert Record objects to dicts preserving graph types
                records = []
                for record in eager_result.records:
                    records.append({key: record[key] for key in record.keys()})

            except asyncio.TimeoutError:
                return QueryError(message="Query timed out", code="TIMEOUT")
            except Exception as e:
                if ctx.cancelled:
                    return QueryError(message="Query cancelled", code="CANCELLED")
                return QueryError(message=str(e))

            elapsed = (time.monotonic() - start) * 1000

            # Transform results
            return _transform_neo4j_results(records, elapsed)

    finally:
        await driver.close()


def _is_graph_value(val: Any) -> bool:
    """Check if a serialized value is a graph object (node, relationship, or path)."""
    return isinstance(val, dict) and val.get("__type") in ("node", "rel", "path")


def _is_paths_only(rows: list[list[Any]]) -> bool:
    """Check if all values in rows are paths (no clickable nodes/rels)."""
    if not rows:
        return False
    for row in rows:
        for val in row:
            if isinstance(val, dict):
                val_type = val.get("__type")
                if val_type in ("node", "rel"):
                    return False  # Has clickable elements
                if val_type != "path":
                    return False  # Has non-graph value
            else:
                return False  # Has scalar value
    return True  # All values are paths


def _check_graph_compatible(rows: list[list[Any]]) -> bool:
    """Check if all values in rows are graph objects."""
    for row in rows:
        for val in row:
            if not _is_graph_value(val):
                return False
    return True


def _transform_neo4j_results(records: list[dict], elapsed_ms: float) -> QueryResult:
    """Transform Neo4j records to unified format."""
    if not records:
        return QueryResult(columns=[], rows=[], execution_time_ms=elapsed_ms)

    columns = list(records[0].keys())
    rows: list[list[Any]] = []
    nodes: dict[str, GraphNode] = {}
    relationships: dict[str, GraphRelationship] = {}

    for record in records:
        row = []
        for col in columns:
            val = record[col]
            row.append(_serialize_neo4j_value(val, nodes, relationships))
        rows.append(row)

    return QueryResult(
        columns=columns,
        rows=rows,
        nodes=list(nodes.values()),
        relationships=list(relationships.values()),
        execution_time_ms=elapsed_ms,
        row_count=len(rows),
        is_graph_compatible=_check_graph_compatible(rows) and len(relationships) > 0,
        is_paths_only=_is_paths_only(rows),
    )


def _get_display_name(props: dict) -> str:
    """Get a display name from node/rel properties."""
    for key in ("name", "title", "label", "id"):
        if key in props and props[key]:
            val = str(props[key])
            # Truncate long values
            return val[:50] + "..." if len(val) > 50 else val
    return ""


def _serialize_neo4j_value(
    val: Any,
    nodes: dict[str, GraphNode],
    rels: dict[str, GraphRelationship],
) -> Any:
    """Serialize Neo4j value, extracting nodes/relationships."""
    from neo4j.graph import Node, Path, Relationship

    if isinstance(val, Node):
        node_id = val.element_id
        labels = list(val.labels)
        props = dict(val)
        if node_id not in nodes:
            nodes[node_id] = GraphNode(
                id=node_id,
                labels=labels,
                properties=props,
            )
        label = labels[0] if labels else ""
        display = _get_display_name(props)
        if label and display:
            display_text = f"({label}: {display})"
        elif label:
            display_text = f"({label})"
        else:
            display_text = "(Node)"
        return {"__type": "node", "id": node_id, "display": display_text}

    if isinstance(val, Relationship):
        rel_id = val.element_id
        rel_type = val.type
        if rel_id not in rels:
            start_id = val.start_node.element_id if val.start_node else ""
            end_id = val.end_node.element_id if val.end_node else ""
            rels[rel_id] = GraphRelationship(
                id=rel_id,
                type=rel_type,
                start_node_id=start_id,
                end_node_id=end_id,
                properties=dict(val),
            )
        display_text = f"-[:{rel_type}]->" if rel_type else "-[rel]->"
        return {"__type": "rel", "id": rel_id, "display": display_text}

    if isinstance(val, Path):
        # Extract all nodes and relationships from path
        for node in val.nodes:
            _serialize_neo4j_value(node, nodes, rels)
        for rel in val.relationships:
            _serialize_neo4j_value(rel, nodes, rels)
        return {"__type": "path", "display": f"Path(length={len(val)})"}

    if isinstance(val, list):
        return [_serialize_neo4j_value(v, nodes, rels) for v in val]

    if isinstance(val, dict):
        return {k: _serialize_neo4j_value(v, nodes, rels) for k, v in val.items()}

    return val


def _parse_cypher_return_columns(cypher: str) -> list[str]:
    """Parse RETURN clause from Cypher query to extract column names.

    Handles:
    - Simple returns: RETURN n, m, r
    - Aliases: RETURN n AS node, m AS other
    - Expressions: RETURN n.name, count(*) AS cnt
    - Path variables: RETURN g, n, p (from MATCH g=(n)-[]->(p))
    """
    # Find the RETURN clause (case insensitive)
    # Stop at ORDER BY, SKIP, LIMIT, UNION, or end of query
    return_match = re.search(
        r'\bRETURN\s+(DISTINCT\s+)?(.*?)(?:\s+ORDER\s+BY|\s+SKIP|\s+LIMIT|\s+UNION|$)',
        cypher,
        re.IGNORECASE | re.DOTALL
    )

    if not return_match:
        # No RETURN found, default to single result column
        return ["result"]

    return_clause = return_match.group(2).strip()

    # Split by comma, but respect parentheses (for function calls)
    columns = []
    current = ""
    paren_depth = 0
    bracket_depth = 0

    for char in return_clause:
        if char == '(':
            paren_depth += 1
            current += char
        elif char == ')':
            paren_depth -= 1
            current += char
        elif char == '[':
            bracket_depth += 1
            current += char
        elif char == ']':
            bracket_depth -= 1
            current += char
        elif char == ',' and paren_depth == 0 and bracket_depth == 0:
            columns.append(current.strip())
            current = ""
        else:
            current += char

    if current.strip():
        columns.append(current.strip())

    # Extract column names (use alias if present, otherwise derive from expression)
    result = []
    for col in columns:
        col = col.strip()
        if not col:
            continue

        # Check for AS alias (case insensitive)
        alias_match = re.search(r'\s+AS\s+(\w+)\s*$', col, re.IGNORECASE)
        if alias_match:
            result.append(alias_match.group(1))
        else:
            # No alias - extract the identifier
            # For "n.name" -> use "name" or just use a generated name
            # For simple "n" -> use "n"
            # For "count(*)" -> use generated name

            # Try to get a simple identifier
            simple_match = re.match(r'^(\w+)$', col)
            if simple_match:
                result.append(simple_match.group(1))
            else:
                # Property access like n.name
                prop_match = re.match(r'^\w+\.(\w+)$', col)
                if prop_match:
                    result.append(prop_match.group(1))
                else:
                    # Complex expression - generate a name
                    result.append(f"col{len(result) + 1}")

    return result if result else ["result"]


def _build_age_wrapper(graph_name: str, cypher: str) -> str:
    """Build the AGE SQL wrapper for a Cypher query."""
    columns = _parse_cypher_return_columns(cypher)
    # Escape $$ in the cypher query
    escaped = cypher.replace("$$", r"\$\$")
    # Build the AS clause with agtype for each column
    as_clause = ", ".join(f"{col} agtype" for col in columns)

    return f"""SELECT * FROM cypher('{graph_name}', $$
{escaped}
$$) AS ({as_clause});"""


async def _execute_age(
    config: AgeConnection,
    query: str,
    timeout_ms: int,
    session_id: str,
    query_id: str,
    cypher_only: bool,
) -> QueryResult | QueryError:
    """Execute query against PostgreSQL AGE."""
    conn = await psycopg.AsyncConnection.connect(
        host=config.host,
        port=config.port,
        dbname=config.database,
        user=config.username,
        password=config.password,
    )

    try:
        # Load AGE extension
        await conn.execute(sql.SQL("LOAD 'age'"))
        await conn.execute(sql.SQL("SET search_path = ag_catalog, '$user', public"))

        # Get backend PID for cancellation
        result = await conn.execute(sql.SQL("SELECT pg_backend_pid()"))
        pid_row = await result.fetchone()
        pg_pid = pid_row[0] if pid_row else None

        # Register for cancellation
        ctx = ExecutionContext(
            session_id=session_id,
            query_id=query_id,
            pg_conn=conn,
            pg_pid=pg_pid,
        )
        _running_queries[session_id] = ctx

        # Wrap query if cypher_only mode
        if cypher_only:
            query = _build_age_wrapper(config.graph_name, query)

        # Set statement timeout
        await conn.execute(sql.SQL("SET statement_timeout = {}").format(sql.Literal(timeout_ms)))

        start = time.monotonic()

        try:
            # Note: query is user-provided, so we use type: ignore for LiteralString
            cursor = await conn.execute(sql.SQL(query))  # type: ignore[arg-type]
            rows_raw = await cursor.fetchall()
            columns = (
                [desc[0] for desc in cursor.description] if cursor.description else []
            )
        except psycopg.errors.QueryCanceled:
            if ctx.cancelled:
                return QueryError(message="Query cancelled", code="CANCELLED")
            return QueryError(message="Query timed out", code="TIMEOUT")
        except psycopg.Error as e:
            return QueryError(message=str(e), code=e.sqlstate)

        elapsed = (time.monotonic() - start) * 1000

        return _transform_age_results(columns, rows_raw, elapsed)

    finally:
        await conn.close()


def _transform_age_results(
    columns: list[str],
    rows_raw: list[tuple],
    elapsed_ms: float,
) -> QueryResult:
    """Transform AGE results to unified format."""
    rows: list[list[Any]] = []
    nodes: dict[str, GraphNode] = {}
    relationships: dict[str, GraphRelationship] = {}

    for row in rows_raw:
        transformed_row = []
        for val in row:
            transformed_row.append(_serialize_age_value(val, nodes, relationships))
        rows.append(transformed_row)

    return QueryResult(
        columns=columns,
        rows=rows,
        nodes=list(nodes.values()),
        relationships=list(relationships.values()),
        execution_time_ms=elapsed_ms,
        row_count=len(rows),
        is_graph_compatible=_check_graph_compatible(rows) and len(relationships) > 0,
        is_paths_only=_is_paths_only(rows),
    )


def _serialize_age_value(
    val: Any,
    nodes: dict[str, GraphNode],
    rels: dict[str, GraphRelationship],
) -> Any:
    """Serialize AGE agtype value."""
    if val is None:
        return None

    # AGE returns agtype as string representation
    if isinstance(val, str):
        # Check for path (array of vertices and edges)
        if val.startswith("[") and "::path" in val:
            return _process_age_path(val, nodes, rels)

        # Check for vertex or edge
        if val.startswith("{"):
            try:
                # Try to parse as JSON (AGE vertex/edge format)
                parsed = json.loads(val.replace("::vertex", "").replace("::edge", ""))
                return _process_age_graph_element(parsed, nodes, rels, val)
            except json.JSONDecodeError:
                pass

    return val


def _process_age_path(
    val: str,
    nodes: dict[str, GraphNode],
    rels: dict[str, GraphRelationship],
) -> str | dict[str, str]:
    """Process AGE path value (array of alternating vertices and edges)."""
    # Remove ::path suffix and ::vertex/::edge from elements
    clean = val.replace("::path", "").replace("::vertex", "").replace("::edge", "")

    try:
        # Parse the path array
        path_elements = json.loads(clean)

        if not isinstance(path_elements, list):
            return val

        node_count = 0
        rel_count = 0

        for elem in path_elements:
            if not isinstance(elem, dict):
                continue

            # Distinguish vertex vs edge by checking for start_id/end_id
            if "start_id" in elem or "end_id" in elem:
                # Edge
                rel_id = str(elem.get("id", ""))
                if rel_id and rel_id not in rels:
                    rels[rel_id] = GraphRelationship(
                        id=rel_id,
                        type=elem.get("label", ""),
                        start_node_id=str(elem.get("start_id", "")),
                        end_node_id=str(elem.get("end_id", "")),
                        properties=elem.get("properties", {}),
                    )
                rel_count += 1
            else:
                # Vertex
                node_id = str(elem.get("id", ""))
                if node_id and node_id not in nodes:
                    label = elem.get("label", "")
                    props = elem.get("properties", {})
                    nodes[node_id] = GraphNode(
                        id=node_id,
                        labels=[label] if label else [],
                        properties=props,
                    )
                node_count += 1

        return {"__type": "path", "display": f"Path(nodes={node_count}, rels={rel_count})"}

    except json.JSONDecodeError:
        return val


def _process_age_graph_element(
    parsed: dict,
    nodes: dict[str, GraphNode],
    rels: dict[str, GraphRelationship],
    original: str,
) -> dict | str:
    """Process parsed AGE graph element."""
    if "::vertex" in original:
        # It's a node
        node_id = str(parsed.get("id", ""))
        label = parsed.get("label", "")
        props = parsed.get("properties", {})
        if node_id and node_id not in nodes:
            nodes[node_id] = GraphNode(
                id=node_id,
                labels=[label] if label else [],
                properties=props,
            )
        display = _get_display_name(props)
        if label and display:
            display_text = f"({label}: {display})"
        elif label:
            display_text = f"({label})"
        else:
            display_text = f"(Node)"
        return {"__type": "node", "id": node_id, "display": display_text}

    if "::edge" in original:
        # It's a relationship
        rel_id = str(parsed.get("id", ""))
        rel_type = parsed.get("label", "")
        props = parsed.get("properties", {})
        if rel_id and rel_id not in rels:
            rels[rel_id] = GraphRelationship(
                id=rel_id,
                type=rel_type,
                start_node_id=str(parsed.get("start_id", "")),
                end_node_id=str(parsed.get("end_id", "")),
                properties=props,
            )
        display_text = f"-[:{rel_type}]->" if rel_type else "-[rel]->"
        return {"__type": "rel", "id": rel_id, "display": display_text}

    return str(parsed)
