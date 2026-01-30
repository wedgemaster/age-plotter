"""PostgreSQL AGE database client."""

import psycopg

from ..models.connection import AgeConnection


class AgeClient:
    """Async client for PostgreSQL AGE database operations."""

    def __init__(self, config: AgeConnection) -> None:
        self.config = config
        self.conn: psycopg.AsyncConnection | None = None

    async def connect(self) -> None:
        """Establish connection and load AGE extension."""
        self.conn = await psycopg.AsyncConnection.connect(
            host=self.config.host,
            port=self.config.port,
            dbname=self.config.database,
            user=self.config.username,
            password=self.config.password,
        )
        # Load AGE extension
        await self.conn.execute("LOAD 'age';")
        await self.conn.execute("SET search_path = ag_catalog, '$user', public;")

    async def test_connection(self) -> bool:
        """Verify connection and graph exists."""
        if self.conn is None:
            return False
        try:
            # Check if the graph exists
            result = await self.conn.execute(
                "SELECT * FROM ag_catalog.ag_graph WHERE name = %s",
                (self.config.graph_name,),
            )
            row = await result.fetchone()
            return row is not None
        except Exception:
            return False

    async def close(self) -> None:
        """Close the database connection."""
        if self.conn:
            await self.conn.close()
            self.conn = None


async def test_age_connection(config: AgeConnection) -> tuple[bool, str]:
    """Test an AGE connection configuration.

    Returns (success, message) tuple.
    """
    client = AgeClient(config)
    try:
        await client.connect()
        if await client.test_connection():
            return True, "Connection successful"
        return False, f"Graph '{config.graph_name}' not found"
    except Exception as e:
        return False, str(e)
    finally:
        await client.close()
