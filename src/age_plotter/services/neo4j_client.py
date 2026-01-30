"""Neo4j database client."""

from neo4j import AsyncGraphDatabase, AsyncDriver

from ..models.connection import Neo4jConnection


class Neo4jClient:
    """Async client for Neo4j database operations."""

    def __init__(self, config: Neo4jConnection) -> None:
        self.driver: AsyncDriver = AsyncGraphDatabase.driver(
            config.uri,
            auth=(config.username, config.password),
        )
        self.database = config.database

    async def test_connection(self) -> bool:
        """Verify connection works by running a simple query."""
        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run("RETURN 1 AS n")
                record = await result.single()
                return record is not None and record["n"] == 1
        except Exception:
            return False

    async def close(self) -> None:
        """Close the driver connection."""
        await self.driver.close()


async def test_neo4j_connection(config: Neo4jConnection) -> tuple[bool, str]:
    """Test a Neo4j connection configuration.

    Returns (success, message) tuple.
    """
    client = Neo4jClient(config)
    try:
        if await client.test_connection():
            return True, "Connection successful"
        return False, "Connection test query failed"
    except Exception as e:
        return False, str(e)
    finally:
        await client.close()
