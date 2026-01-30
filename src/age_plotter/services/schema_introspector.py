"""Schema introspection for Neo4j and AGE databases."""

from dataclasses import dataclass

import psycopg
from neo4j import AsyncGraphDatabase

from ..models.connection import AgeConnection, Neo4jConnection


@dataclass
class GraphSchema:
    """Schema information for a graph database."""

    labels: list[str]
    relationship_types: list[str]
    property_keys: list[str]


async def introspect_neo4j(config: Neo4jConnection) -> GraphSchema:
    """Fetch schema from Neo4j using CALL db.* procedures."""
    driver = AsyncGraphDatabase.driver(
        config.uri,
        auth=(config.username, config.password),
    )
    try:
        async with driver.session(database=config.database) as session:
            # Fetch labels
            labels_result = await session.run("CALL db.labels()")
            labels = [record["label"] async for record in labels_result]

            # Fetch relationship types
            types_result = await session.run("CALL db.relationshipTypes()")
            rel_types = [record["relationshipType"] async for record in types_result]

            # Fetch property keys
            props_result = await session.run("CALL db.propertyKeys()")
            props = [record["propertyKey"] async for record in props_result]

            return GraphSchema(
                labels=sorted(labels),
                relationship_types=sorted(rel_types),
                property_keys=sorted(props),
            )
    finally:
        await driver.close()


async def introspect_age(config: AgeConnection) -> GraphSchema:
    """Fetch schema from AGE via ag_catalog queries."""
    conn = await psycopg.AsyncConnection.connect(
        host=config.host,
        port=config.port,
        dbname=config.database,
        user=config.username,
        password=config.password,
    )
    try:
        await conn.execute("LOAD 'age';")
        await conn.execute("SET search_path = ag_catalog, '$user', public;")

        # Get graph OID
        graph_result = await conn.execute(
            "SELECT graphid FROM ag_graph WHERE name = %s",
            (config.graph_name,),
        )
        graph_row = await graph_result.fetchone()
        if not graph_row:
            return GraphSchema(labels=[], relationship_types=[], property_keys=[])

        graph_id = graph_row[0]

        # Get labels from ag_label (excluding internal labels)
        labels_result = await conn.execute(
            """
            SELECT name, kind FROM ag_label
            WHERE graph = %s AND name NOT IN ('_ag_label_vertex', '_ag_label_edge')
            """,
            (graph_id,),
        )

        labels = []
        rel_types = []
        label_names = []
        async for row in labels_result:
            name, kind = row
            label_names.append(name)
            if kind == "v":
                labels.append(name)
            elif kind == "e":
                rel_types.append(name)

        # Sample property keys from label tables
        property_keys: set[str] = set()
        for label in label_names:
            try:
                # AGE stores each label in its own table under the graph schema
                # Use SQL composition to safely quote identifiers
                from psycopg import sql

                query = sql.SQL("SELECT properties FROM {}.{} LIMIT 5").format(
                    sql.Identifier(config.graph_name),
                    sql.Identifier(label),
                )
                sample_result = await conn.execute(query)
                async for row in sample_result:
                    if row[0]:
                        props_str = str(row[0])
                        # AGE returns agtype which looks like JSON
                        if props_str.startswith("{"):
                            import json

                            try:
                                props = json.loads(props_str)
                                property_keys.update(props.keys())
                            except json.JSONDecodeError:
                                pass
            except Exception:
                # Skip if table doesn't exist or query fails
                pass

        return GraphSchema(
            labels=sorted(labels),
            relationship_types=sorted(rel_types),
            property_keys=sorted(property_keys),
        )
    finally:
        await conn.close()
