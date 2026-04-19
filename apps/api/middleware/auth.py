"""
JWT Auth Middleware

Validates Supabase-issued JWTs on protected FastAPI routes.
Uses SUPABASE_JWT_SECRET (HS256) to verify Bearer tokens — no shared secret needed.

Public routes (no auth required):
  /health, /, /api/v1/spots*, /api/v1/forecast*, /api/v1/buoys*,
  /api/v1/safety*, /api/v1/snow*, /api/v1/gear*

Protected routes (require valid Supabase JWT):
  /api/v1/sessions*, /api/v1/nlq*, /api/v1/stoke*,
  /api/v1/optimal*, /api/v1/insights*, /api/v1/swell_events*

In development (SUPABASE_JWT_SECRET not set), validation is skipped with a warning.
"""
from __future__ import annotations

import jwt as pyjwt
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from config import settings

logger = structlog.get_logger(__name__)

# Exact paths that never require auth
_PUBLIC_EXACT = {"/", "/health"}

# Path prefixes that are always public (no user data, no compute risk)
_PUBLIC_PREFIXES = (
    "/api/v1/spots",
    "/api/v1/forecast",
    "/api/v1/buoys",
    "/api/v1/safety",
    "/api/v1/snow",
    "/api/v1/gear",
    # Debug — only registered when settings.debug=True
    "/docs",
    "/redoc",
    "/openapi.json",
)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Verify Supabase JWTs on protected routes; pass public routes through."""

    def __init__(self, app, jwt_secret: str) -> None:
        super().__init__(app)
        self.jwt_secret = jwt_secret
        if not jwt_secret:
            logger.warning(
                "JWTAuthMiddleware: SUPABASE_JWT_SECRET is not set — "
                "JWT verification is DISABLED on protected routes. Set it in production."
            )

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Public paths — always allowed
        if path in _PUBLIC_EXACT or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
            return await call_next(request)

        # Dev mode — no secret, skip verification
        if not self.jwt_secret:
            return await call_next(request)

        # Require Bearer JWT
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required", "detail": "Provide a Bearer token"},
            )

        token = auth_header[7:]
        try:
            payload = pyjwt.decode(
                token,
                self.jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            request.state.user_id = payload.get("sub")
        except pyjwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"error": "Token expired"})
        except pyjwt.InvalidTokenError as exc:
            logger.warning("JWT validation failed", error=str(exc), path=path)
            return JSONResponse(status_code=401, content={"error": "Invalid token"})

        return await call_next(request)
