"""Logging setup, called from every process entrypoint (API and Celery)."""

import logging
import os

_CONFIGURED = False


def setup_logging() -> None:
    """Configure root logging once per process.

    Idempotent: Celery and uvicorn both import modules that may call this,
    and basicConfig silently does nothing after the first handler is added.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    _CONFIGURED = True
