"""Query result model definitions."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class GraphNode:
    """A node in query results."""

    id: str  # Internal ID (Neo4j element ID or AGE vertex id)
    labels: list[str]
    properties: dict[str, Any]


@dataclass
class GraphRelationship:
    """A relationship in query results."""

    id: str
    type: str
    start_node_id: str
    end_node_id: str
    properties: dict[str, Any]


@dataclass
class QueryResult:
    """Unified query result format."""

    columns: list[str]
    rows: list[list[Any]]  # Tabular data (scalars serialized)
    nodes: list[GraphNode] = field(default_factory=list)
    relationships: list[GraphRelationship] = field(default_factory=list)
    execution_time_ms: float = 0.0
    row_count: int = 0
    is_graph_compatible: bool = True  # False if result contains scalars
    is_paths_only: bool = False  # True if all values are paths (table not useful)


@dataclass
class QueryError:
    """Query execution error."""

    message: str
    code: str | None = None  # DB-specific error code
    line: int | None = None  # Line number if available
