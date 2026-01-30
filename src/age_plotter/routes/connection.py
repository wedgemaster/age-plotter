"""Connection management routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from ..models.connection import (
    AgeConnection,
    ConnectionType,
    Neo4jConnection,
    StoredConnection,
)
from ..services import (
    ConnectionStore,
    get_connection_store,
    test_age_connection,
    test_neo4j_connection,
)

router = APIRouter()


def get_templates() -> Jinja2Templates:
    """Get templates from app state."""
    from ..main import templates

    return templates


def get_session_id(request: Request) -> str:
    """Get or create session ID from cookie."""
    session_id = request.session.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        request.session["session_id"] = session_id
    return session_id


@router.get("/", response_class=HTMLResponse)
async def connection_page(
    request: Request,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
) -> HTMLResponse:
    """Render the connection management page."""
    templates = get_templates()
    session_id = get_session_id(request)
    connections = store.list(session_id)
    active = store.get_active(session_id)

    return templates.TemplateResponse(
        request=request,
        name="connection.html",
        context={
            "connections": connections,
            "active_connection": active,
            "error": None,
            "success": None,
        },
    )


@router.post("/connections", response_class=HTMLResponse, response_model=None)
async def create_connection(
    request: Request,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
    connection_name: Annotated[str, Form()],
    connection_type: Annotated[str, Form()],
    # Neo4j fields
    neo4j_uri: Annotated[str | None, Form()] = None,
    neo4j_username: Annotated[str | None, Form()] = None,
    neo4j_password: Annotated[str | None, Form()] = None,
    neo4j_database: Annotated[str | None, Form()] = "neo4j",
    # AGE fields
    age_host: Annotated[str | None, Form()] = None,
    age_port: Annotated[int | None, Form()] = 5432,
    age_database: Annotated[str | None, Form()] = None,
    age_username: Annotated[str | None, Form()] = None,
    age_password: Annotated[str | None, Form()] = None,
    age_graph_name: Annotated[str | None, Form()] = None,
) -> HTMLResponse | RedirectResponse:
    """Create and test a new connection."""
    templates = get_templates()
    session_id = get_session_id(request)

    error: str | None = None

    # Check for duplicate name
    existing = store.list(session_id)
    if any(c.name == connection_name for c in existing):
        error = f"Connection name '{connection_name}' already exists"

    conn_type = ConnectionType(connection_type)

    if error:
        pass  # Skip connection creation if name already exists
    elif conn_type == ConnectionType.NEO4J:
        if not all([neo4j_uri, neo4j_username, neo4j_password]):
            error = "Missing required Neo4j fields"
        else:
            config = Neo4jConnection(
                uri=neo4j_uri,  # type: ignore
                username=neo4j_username,  # type: ignore
                password=neo4j_password,  # type: ignore
                database=neo4j_database or "neo4j",
            )
            ok, msg = await test_neo4j_connection(config)
            if ok:
                stored = StoredConnection(
                    id=str(uuid.uuid4()),
                    name=connection_name,
                    type=conn_type,
                    config=config,
                )
                store.add(session_id, stored)
                store.set_active(session_id, stored.id)
                return RedirectResponse(url="/query", status_code=303)
            else:
                error = f"Connection test failed: {msg}"

    elif conn_type == ConnectionType.AGE:
        if not all([age_host, age_database, age_username, age_password, age_graph_name]):
            error = "Missing required AGE fields"
        else:
            config = AgeConnection(
                host=age_host,  # type: ignore
                port=age_port or 5432,
                database=age_database,  # type: ignore
                username=age_username,  # type: ignore
                password=age_password,  # type: ignore
                graph_name=age_graph_name,  # type: ignore
            )
            ok, msg = await test_age_connection(config)
            if ok:
                stored = StoredConnection(
                    id=str(uuid.uuid4()),
                    name=connection_name,
                    type=conn_type,
                    config=config,
                )
                store.add(session_id, stored)
                store.set_active(session_id, stored.id)
                return RedirectResponse(url="/query", status_code=303)
            else:
                error = f"Connection test failed: {msg}"

    connections = store.list(session_id)
    active = store.get_active(session_id)

    # Preserve form values on error
    form_values = {
        "connection_name": connection_name if error else "",
        "connection_type": connection_type if error else "neo4j",
        "neo4j_uri": neo4j_uri or "bolt://localhost:7687",
        "neo4j_username": neo4j_username or "neo4j",
        "neo4j_password": neo4j_password or "",
        "neo4j_database": neo4j_database or "neo4j",
        "age_host": age_host or "localhost",
        "age_port": age_port or 5432,
        "age_database": age_database or "",
        "age_username": age_username or "postgres",
        "age_password": age_password or "",
        "age_graph_name": age_graph_name or "",
    } if error else None

    return templates.TemplateResponse(
        request=request,
        name="connection.html",
        context={
            "connections": connections,
            "active_connection": active,
            "error": error,
            "success": None,
            "form": form_values,
        },
    )


@router.post("/connections/{connection_id}/select", response_class=HTMLResponse, response_model=None)
async def select_connection(
    request: Request,
    connection_id: str,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
) -> HTMLResponse | RedirectResponse:
    """Test connection, set as active if successful, redirect to query page."""
    templates = get_templates()
    session_id = get_session_id(request)

    connection = store.get(session_id, connection_id)
    if not connection:
        return templates.TemplateResponse(
            request=request,
            name="connection.html",
            context={
                "connections": store.list(session_id),
                "active_connection": store.get_active(session_id),
                "error": "Connection not found",
                "success": None,
                "form": None,
            },
        )

    # Test the connection
    if connection.type == ConnectionType.NEO4J:
        ok, msg = await test_neo4j_connection(connection.config)  # type: ignore
    else:
        ok, msg = await test_age_connection(connection.config)  # type: ignore

    if not ok:
        return templates.TemplateResponse(
            request=request,
            name="connection.html",
            context={
                "connections": store.list(session_id),
                "active_connection": store.get_active(session_id),
                "error": f"Connection failed: {msg}",
                "success": None,
                "form": None,
            },
        )

    # Connection successful, set as active
    store.set_active(session_id, connection_id)
    return RedirectResponse(url="/query", status_code=303)


@router.delete("/connections/{connection_id}", response_class=HTMLResponse)
async def delete_connection(
    request: Request,
    connection_id: str,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
) -> HTMLResponse:
    """Delete a connection and return updated list."""
    templates = get_templates()
    session_id = get_session_id(request)

    store.remove(session_id, connection_id)

    connections = store.list(session_id)
    active = store.get_active(session_id)

    return templates.TemplateResponse(
        request=request,
        name="connection.html",
        context={
            "connections": connections,
            "active_connection": active,
            "error": None,
            "success": "Connection deleted",
        },
    )
