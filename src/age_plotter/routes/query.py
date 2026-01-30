"""Query editor and execution routes."""

import uuid
from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from ..models.connection import AgeConnection, ConnectionType
from ..models.result import QueryError, QueryResult
from ..services import ConnectionStore, cancel_query, execute_query, get_connection_store

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


@router.get("/query", response_class=HTMLResponse, response_model=None)
async def query_page(
    request: Request,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
) -> HTMLResponse | RedirectResponse:
    """Render query editor. Redirect if no active connection."""
    templates = get_templates()
    session_id = get_session_id(request)
    connection = store.get_active(session_id)

    if not connection:
        return RedirectResponse(url="/", status_code=303)

    # Get graph name for AGE connections
    graph_name = ""
    if connection.type == ConnectionType.AGE:
        config: AgeConnection = connection.config  # type: ignore
        graph_name = config.graph_name

    return templates.TemplateResponse(
        request=request,
        name="query.html",
        context={
            "connection": connection,
            "connection_type": connection.type.value,
            "graph_name": graph_name,
        },
    )


@router.post("/query/execute", response_class=HTMLResponse)
async def execute_query_endpoint(
    request: Request,
    store: Annotated[ConnectionStore, Depends(get_connection_store)],
    query: Annotated[str, Form()],
    timeout: Annotated[int, Form()] = 30000,
    cypher_only: Annotated[bool, Form()] = False,
) -> HTMLResponse:
    """Execute query and return results partial."""
    templates = get_templates()
    session_id = get_session_id(request)
    connection = store.get_active(session_id)

    if not connection:
        return templates.TemplateResponse(
            request=request,
            name="partials/error.html",
            context={"error": "No active connection"},
        )

    result = await execute_query(
        connection=connection,
        query=query,
        timeout_ms=timeout,
        session_id=session_id,
        cypher_only=cypher_only,
    )

    if isinstance(result, QueryError):
        return templates.TemplateResponse(
            request=request,
            name="partials/error.html",
            context={"error": result.message, "code": result.code},
        )

    # Serialize graph data for JSON embedding in template
    nodes_json = [asdict(n) for n in result.nodes]
    relationships_json = [asdict(r) for r in result.relationships]

    return templates.TemplateResponse(
        request=request,
        name="partials/result_panel.html",
        context={
            "result": result,
            "query": query,
            "panel_id": f"panel-{uuid.uuid4().hex[:8]}",
            "nodes_json": nodes_json,
            "relationships_json": relationships_json,
            "is_graph_compatible": result.is_graph_compatible,
            "is_paths_only": result.is_paths_only,
        },
    )


@router.post("/query/cancel")
async def cancel_query_endpoint(
    request: Request,
) -> dict:
    """Cancel running query for this session."""
    session_id = get_session_id(request)
    success = await cancel_query(session_id)
    return {"cancelled": success}
