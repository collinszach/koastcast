"""
API Key Authentication Middleware

For B2B API access (Explorer tier).
Checks Authorization: Bearer <key> header.
Looks up key hash in api_keys Supabase table.
Injects user context and increments usage counter.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = structlog.get_logger(__name__)

_bearer = HTTPBearer(auto_error=False)


def _hash_key(api_key: str) -> str:
    """SHA-256 hash of the API key — only hashes are stored in DB."""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def get_api_key_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_bearer)] = None,
) -> dict | None:
    """
    FastAPI dependency: validates an API key and returns the owning user info.

    Returns None if no API key header is present (allows optional use).
    Raises 401/403 for invalid/revoked/rate-limited keys.
    """
    if credentials is None:
        return None

    raw_key = credentials.credentials
    key_hash = _hash_key(raw_key)

    try:
        from db.supabase_client import get_client
        client = get_client()
        result = await client.table("api_keys").select(
            "user_id, requests_this_month, monthly_limit, revoked, tier"
        ).eq("key_hash", key_hash).single().execute()
    except Exception as exc:
        logger.warning("API key lookup failed", error=str(exc))
        raise HTTPException(status_code=401, detail="Invalid API key")

    row = result.data
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")

    if row.get("revoked"):
        raise HTTPException(status_code=403, detail="API key has been revoked")

    monthly_limit = row.get("monthly_limit", 10_000)
    requests_this_month = row.get("requests_this_month", 0)
    if requests_this_month >= monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly API limit reached ({monthly_limit} requests). Upgrade to Explorer for more.",
        )

    # Increment usage counter asynchronously (fire-and-forget)
    try:
        await client.table("api_keys").update(
            {"requests_this_month": requests_this_month + 1}
        ).eq("key_hash", key_hash).execute()
    except Exception as exc:
        logger.warning("Failed to increment API key usage", error=str(exc))

    return {
        "user_id": row["user_id"],
        "tier": row.get("tier", "explorer"),
        "requests_this_month": requests_this_month + 1,
        "monthly_limit": monthly_limit,
    }


# Convenience: require API key (for B2B-only endpoints)
async def require_api_key(
    key_user: Annotated[dict | None, Depends(get_api_key_user)],
) -> dict:
    if key_user is None:
        raise HTTPException(status_code=401, detail="API key required. Set Authorization: Bearer <key>")
    return key_user
