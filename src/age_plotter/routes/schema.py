"""Schema introspection routes."""

import uuid
from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..models.connection import ConnectionType
from ..services import ConnectionStore, get_connection_store
from ..services.schema_introspector import (
    introspect_age,
    introspect_neo4j,
)

router = APIRouter(prefix="/schema", tags=["schema"])


def get_session_id(request: Request) -> str:
    """Get or create session ID from cookie."""
    session_id = request.session.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        request.session["session_id"] = session_id
    return session_id


@router.get("")
async def get_schema(
    request: Request,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
) -> JSONResponse:
    """Fetch schema for the active connection."""
    session_id = get_session_id(request)
    connection = store.get_active(session_id)

    if not connection:
        return JSONResponse(
            status_code=400,
            content={"error": "No active connection"},
        )

    try:
        if connection.type == ConnectionType.NEO4J:
            schema = await introspect_neo4j(connection.config)  # type: ignore
        else:
            schema = await introspect_age(connection.config)  # type: ignore

        return JSONResponse(content=asdict(schema))

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )
