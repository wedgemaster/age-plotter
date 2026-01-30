"""FastAPI application entry point."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .routes import connection_router, query_router, schema_router

# Paths
BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

# App setup
app = FastAPI(title="Age Plotter")

# Session middleware with secret key (in production, use env var)
app.add_middleware(SessionMiddleware, secret_key="dev-secret-key-change-in-prod")

# Static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Templates (available as dependency)
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# Routes
app.include_router(connection_router)
app.include_router(query_router)
app.include_router(schema_router)


def get_templates() -> Jinja2Templates:
    """Dependency to get templates instance."""
    return templates
