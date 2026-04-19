"""
API Secret Middleware

Validates the X-API-Secret header on all incoming requests to the FastAPI backend.
The secret must match the SECRET_KEY env var configured on both the NUC API and
the Next.js frontend (NUC_API_SECRET).

If SECRET_KEY is empty or not set (dev mode), validation is skipped and a warning
is logged so the insecure path is visible.
"""
from __future__ import annotations

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = structlog.get_logger(__name__)

# Paths that are always public — no secret required.
# Note: /docs, /redoc, /openapi.json are only registered in debug mode (see main.py).
_PUBLIC_PATHS = {"/health", "/"}

# Known placeholder values that indicate SECRET_KEY was not properly configured
_PLACEHOLDER_SECRETS = {"dev-secret-change-in-production", "change-me-in-production-use-openssl-rand-hex-32", ""}


class APISecretMiddleware(BaseHTTPMiddleware):
    """Validate X-API-Secret header on all requests except health/root."""

    def __init__(self, app, secret: str) -> None:
        super().__init__(app)
        self.secret = secret if secret not in _PLACEHOLDER_SECRETS else ""
        if not self.secret:
            logger.warning(
                "APISecretMiddleware: SECRET_KEY is not set or is a placeholder — "
                "API secret validation is DISABLED. Set SECRET_KEY in production."
            )

    async def dispatch(self, request: Request, call_next):
        # Always allow public paths
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        # Dev mode — no secret configured, skip validation
        if not self.secret:
            return await call_next(request)

        provided = request.headers.get("X-API-Secret", "")
        if not provided or provided != self.secret:
            logger.warning(
                "Rejected request — invalid or missing X-API-Secret",
                path=request.url.path,
                method=request.method,
            )
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid or missing API secret"},
            )

        return await call_next(request)
