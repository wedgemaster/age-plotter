"""Connection model definitions."""

from dataclasses import dataclass
from enum import Enum


class ConnectionType(Enum):
    """Supported database connection types."""

    NEO4J = "neo4j"
    AGE = "age"


@dataclass
class Neo4jConnection:
    """Neo4j connection configuration."""

    uri: str  # bolt://localhost:7687
    username: str
    password: str
    database: str = "neo4j"


@dataclass
class AgeConnection:
    """PostgreSQL AGE connection configuration."""

    host: str
    database: str
    username: str
    password: str
    graph_name: str  # AGE graph to query
    port: int = 5432


@dataclass
class StoredConnection:
    """A saved connection with metadata."""

    id: str
    name: str
    type: ConnectionType
    config: Neo4jConnection | AgeConnection
