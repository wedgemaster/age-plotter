"""Connection and result models."""

from .connection import (
    AgeConnection,
    ConnectionType,
    Neo4jConnection,
    StoredConnection,
)
from .result import (
    GraphNode,
    GraphRelationship,
    QueryError,
    QueryResult,
)

__all__ = [
    "AgeConnection",
    "ConnectionType",
    "GraphNode",
    "GraphRelationship",
    "Neo4jConnection",
    "QueryError",
    "QueryResult",
    "StoredConnection",
]
