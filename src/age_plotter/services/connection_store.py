"""In-memory connection store with session isolation."""

import json
import logging
import os
import uuid
from pathlib import Path

from ..models.connection import (
    AgeConnection,
    ConnectionType,
    Neo4jConnection,
    StoredConnection,
)

logger = logging.getLogger(__name__)


class ConnectionStore:
    """Store connections in memory, keyed by session ID."""

    def __init__(self, presets: list[StoredConnection] | None = None) -> None:
        # Outer key: session_id, Inner key: connection_id
        self._connections: dict[str, dict[str, StoredConnection]] = {}
        # Track active connection per session
        self._active: dict[str, str] = {}  # session_id -> connection_id
        # Preset connections to copy to new sessions
        self._presets: list[StoredConnection] = presets or []

    def _ensure_session(self, session_id: str) -> None:
        """Ensure session exists, copying presets if new."""
        if session_id not in self._connections:
            self._connections[session_id] = {}
            # Copy presets to new session (with new IDs)
            for preset in self._presets:
                new_conn = StoredConnection(
                    id=str(uuid.uuid4()),
                    name=preset.name,
                    type=preset.type,
                    config=preset.config,
                )
                self._connections[session_id][new_conn.id] = new_conn

    def add(self, session_id: str, connection: StoredConnection) -> None:
        """Add a connection for a session."""
        self._ensure_session(session_id)
        self._connections[session_id][connection.id] = connection

    def get(self, session_id: str, connection_id: str) -> StoredConnection | None:
        """Get a specific connection."""
        self._ensure_session(session_id)
        return self._connections[session_id].get(connection_id)

    def list(self, session_id: str) -> list[StoredConnection]:
        """List all connections for a session."""
        self._ensure_session(session_id)
        return list(self._connections[session_id].values())

    def remove(self, session_id: str, connection_id: str) -> None:
        """Remove a connection."""
        if session_id in self._connections:
            self._connections[session_id].pop(connection_id, None)
            # Clear active if it was the removed connection
            if self._active.get(session_id) == connection_id:
                del self._active[session_id]

    def clear_session(self, session_id: str) -> None:
        """Remove all connections for a session."""
        self._connections.pop(session_id, None)
        self._active.pop(session_id, None)

    def set_active(self, session_id: str, connection_id: str) -> bool:
        """Set the active connection for a session. Returns True if successful."""
        if self.get(session_id, connection_id) is not None:
            self._active[session_id] = connection_id
            return True
        return False

    def get_active(self, session_id: str) -> StoredConnection | None:
        """Get the active connection for a session."""
        connection_id = self._active.get(session_id)
        if connection_id:
            return self.get(session_id, connection_id)
        return None


def _load_presets_from_json(path: Path) -> list[StoredConnection]:
    """Load preset connections from a JSON file."""
    presets: list[StoredConnection] = []

    try:
        with open(path) as f:
            data = json.load(f)

        connections = data if isinstance(data, list) else data.get("connections", [])

        for i, conn_data in enumerate(connections):
            try:
                conn_type = ConnectionType(conn_data.get("type", "neo4j"))

                if conn_type == ConnectionType.NEO4J:
                    config: Neo4jConnection | AgeConnection = Neo4jConnection(
                        uri=conn_data["uri"],
                        username=conn_data["username"],
                        password=conn_data["password"],
                        database=conn_data.get("database", "neo4j"),
                    )
                else:
                    config = AgeConnection(
                        host=conn_data["host"],
                        port=conn_data.get("port", 5432),
                        database=conn_data["database"],
                        username=conn_data["username"],
                        password=conn_data["password"],
                        graph_name=conn_data["graph_name"],
                    )

                presets.append(
                    StoredConnection(
                        id=str(uuid.uuid4()),
                        name=conn_data.get("name", f"Connection {i + 1}"),
                        type=conn_type,
                        config=config,
                    )
                )
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping invalid connection at index {i}: {e}")

    except FileNotFoundError:
        logger.warning(f"Connections file not found: {path}")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in connections file: {e}")

    if presets:
        logger.info(f"Loaded {len(presets)} preset connection(s) from {path}")

    return presets


# Singleton instance
_store: ConnectionStore | None = None


def get_connection_store() -> ConnectionStore:
    """Get the singleton connection store instance."""
    global _store
    if _store is None:
        presets: list[StoredConnection] = []

        # Load presets from JSON file if configured
        connections_file = os.environ.get("AGE_PLOTTER_CONNECTIONS")
        if connections_file:
            presets = _load_presets_from_json(Path(connections_file))

        _store = ConnectionStore(presets=presets)
    return _store
