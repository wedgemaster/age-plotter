# Architecture

Web UI for querying Neo4j and PostgreSQL AGE graph databases.

## Stack

- **Backend:** Python 3.11+, FastAPI, Jinja2
- **Frontend:** HTMX, Tailwind CSS, DaisyUI
- **Editor:** Monaco (VS Code's editor)
- **Graph rendering:** Cytoscape.js
- **Build:** esbuild (JS), Tailwind CLI (CSS)

## Project Structure

```
src/age_plotter/
├── main.py              # FastAPI app setup, middleware
├── __main__.py          # Entry point (uvicorn runner)
├── models/
│   ├── connection.py    # Neo4jConnection, AgeConnection, StoredConnection
│   └── result.py        # QueryResult, Node, Relationship models
├── services/
│   ├── connection_store.py   # In-memory session-scoped connection storage
│   ├── neo4j_client.py       # Neo4j async driver wrapper
│   ├── age_client.py         # PostgreSQL AGE async driver wrapper
│   ├── query_executor.py     # Query execution with timeout/cancellation
│   └── schema_introspector.py # Fetches labels, relationships, properties
├── routes/
│   ├── connection.py    # Connection management endpoints
│   ├── query.py         # Query execution endpoints
│   └── schema.py        # Schema introspection endpoints
├── templates/           # Jinja2 templates
│   ├── base.html
│   ├── connection.html  # Connection selection/creation page
│   ├── query.html       # Main query interface
│   └── partials/        # HTMX partial templates
└── static/
    ├── js/              # Frontend modules (editor, graph, results)
    ├── css/             # Tailwind input/output
    └── vendor/          # Monaco editor (copied at build time)
```

## Data Flow

```
Browser                     Server                      Database
   │                          │                            │
   │  GET /                   │                            │
   │─────────────────────────>│                            │
   │  connection.html         │                            │
   │<─────────────────────────│                            │
   │                          │                            │
   │  POST /connections       │                            │
   │  {neo4j config}          │                            │
   │─────────────────────────>│  test connection           │
   │                          │───────────────────────────>│
   │                          │<───────────────────────────│
   │  302 → /query            │                            │
   │<─────────────────────────│                            │
   │                          │                            │
   │  POST /query/execute     │                            │
   │  {cypher, timeout}       │                            │
   │─────────────────────────>│  execute query             │
   │                          │───────────────────────────>│
   │                          │<───────────────────────────│
   │  HTML partial            │                            │
   │  (result_panel.html)     │                            │
   │<─────────────────────────│                            │
```

## Key Concepts

### Session Isolation

Each browser session gets a unique `session_id` (stored in signed cookie). The `ConnectionStore` singleton maps session IDs to connection configs. Connections are stored in memory only.

### Connection Types

- **Neo4j:** Bolt protocol via `neo4j` driver
- **AGE:** PostgreSQL with Apache AGE extension via `psycopg`

AGE queries can be either:
- Full SQL with embedded Cypher: `SELECT * FROM cypher('graph', $$ MATCH ... $$) AS (n agtype)`
- Cypher-only mode: wrapper SQL generated automatically

### Query Execution

`query_executor.py` handles:
- Timeout enforcement (asyncio timeout)
- Query cancellation (tracked in `_running_queries` dict)
- Result transformation to unified `QueryResult` model

### Frontend Architecture

- **HTMX** for dynamic updates without full page reloads
- **Monaco Editor** with custom Cypher language definitions (`cypher-neo4j.js`, `cypher-age.js`)
- **Cytoscape.js** for graph visualization with multiple layout algorithms
- **Query history** stored in browser `localStorage`

## Entry Points

| Task | Start Here |
|------|------------|
| Add new route | `routes/` → register in `routes/__init__.py` |
| Modify query execution | `services/query_executor.py` |
| Change result display | `templates/partials/result_panel.html`, `static/js/results.js` |
| Modify graph rendering | `static/js/graph.js` |
| Add editor features | `static/js/editor.js`, `static/js/cypher-*.js` |
| Change connection handling | `services/connection_store.py`, `routes/connection.py` |

## Build Commands

```bash
npm run build          # Build JS bundle + copy Monaco + compile Tailwind
npm run watch:css      # Watch Tailwind changes
npm run watch:js       # Watch JS changes
uv sync                # Install Python dependencies
uv run python -m age_plotter --reload  # Run with hot reload
```
