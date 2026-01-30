# Build frontend assets
FROM node:20-slim AS frontend

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY scripts/ ./scripts/
COPY tailwind.config.js ./
COPY src/age_plotter/static/ ./src/age_plotter/static/
COPY src/age_plotter/templates/ ./src/age_plotter/templates/

RUN npm run build


# Python runtime
FROM python:3.12-slim

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy project files
COPY pyproject.toml ./
COPY src/ ./src/

# Copy built frontend assets
COPY --from=frontend /app/src/age_plotter/static/css/ ./src/age_plotter/static/css/
COPY --from=frontend /app/src/age_plotter/static/vendor/ ./src/age_plotter/static/vendor/

# Install Python dependencies
RUN uv pip install --system --no-cache .

# Default environment
ENV AGE_PLOTTER_HOST=0.0.0.0
ENV AGE_PLOTTER_PORT=8100

EXPOSE 8100

# Run without reload in production
CMD ["python", "-c", "import uvicorn; uvicorn.run('age_plotter.main:app', host='0.0.0.0', port=int(__import__('os').environ.get('AGE_PLOTTER_PORT', '8100')))"]
