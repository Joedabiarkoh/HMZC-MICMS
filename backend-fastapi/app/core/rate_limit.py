import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request, status

# A readiness review flagged this directly: nothing stopped repeated
# password-guessing against /auth/login or spam account creation
# against /auth/register. This is a deliberately simple, dependency-free
# fixed-window limiter — no Redis, no new package to add to
# requirements.txt and hope resolves correctly without a real install
# to test it against.
#
# Real limitation, stated plainly rather than glossed over: this state
# is a plain in-memory dict, per Python process. It works correctly for
# a single backend instance (which is what docker-compose.yml runs
# today) but does NOT share state across multiple replicas/workers — if
# this is ever scaled horizontally, an attacker could get the per-process
# limit on each instance rather than one shared limit. At that point,
# replace this with a Redis-backed limiter (e.g. slowapi with a Redis
# backend) — this is meant as the honest "good enough for one instance,
# not the last word" version, not left silently inadequate.

WINDOW_SECONDS = 60
MAX_ATTEMPTS_PER_WINDOW = 10

_attempts: Dict[str, List[float]] = defaultdict(list)


def _client_key(request: Request, prefix: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"{prefix}:{ip}"


def check_rate_limit(request: Request, prefix: str) -> None:
    """Call at the top of a route. Raises 429 if this client has exceeded the window."""
    key = _client_key(request, prefix)
    now = time.time()
    window_start = now - WINDOW_SECONDS

    attempts = [t for t in _attempts[key] if t > window_start]
    if len(attempts) >= MAX_ATTEMPTS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Try again in a minute.",
        )
    attempts.append(now)
    _attempts[key] = attempts
