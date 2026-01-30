"""Run the Age Plotter application."""

import os

import uvicorn


def main() -> None:
    """Run the application with uvicorn."""
    port = int(os.environ.get("AGE_PLOTTER_PORT", "8100"))
    host = os.environ.get("AGE_PLOTTER_HOST", "127.0.0.1")

    uvicorn.run(
        "age_plotter.main:app",
        host=host,
        port=port,
        reload=True,
    )


if __name__ == "__main__":
    main()
