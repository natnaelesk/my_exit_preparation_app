"""Run slow AI jobs outside the request so they are not killed by the gunicorn timeout."""

import threading
from datetime import timedelta

from django.conf import settings
from django.db import connection


def stale_after():
    """How long a job may go without updating its row before it is presumed dead (e.g. server restart)."""
    return timedelta(seconds=settings.AI_TIMEOUT_SECONDS * 2 + 120)


def run_job(func, *args):
    if settings.AI_JOBS_RUN_INLINE:
        func(*args)
        return

    def target():
        try:
            func(*args)
        finally:
            connection.close()

    threading.Thread(target=target, daemon=True).start()
