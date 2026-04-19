"""
Sessions router
POST   /api/v1/sessions       → log a surf session
GET    /api/v1/sessions       → list user's sessions (paginated)
GET    /api/v1/sessions/{id}  → get a single session
DELETE /api/v1/sessions/{id}  → soft-delete a session
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import jwt as pyjwt
import structlog
from fastapi import APIRouter, HTTPException, Query, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from db.supabase_client import get_client, is_supabase_configured
from models.schemas import SessionCreate, Session

logger = structlog.get_logger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def get_user_id(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str | None:
    """Extract user_id (sub) from a Supabase-issued JWT.

    In production, verifies the JWT signature using SUPABASE_JWT_SECRET.
    In development (no secret configured), decodes without verification and
    logs a warning so the insecure path is visible in logs.
    """
    if not credentials:
        return None

    token = credentials.credentials
    jwt_secret = settings.supabase_jwt_secret

    if not jwt_secret or jwt_secret == "your-supabase-jwt-secret":
        # Dev/demo mode — no secret configured; skip verification with warning
        try:
            logger.warning(
                "JWT signature NOT verified — set SUPABASE_JWT_SECRET for production"
            )
            payload = pyjwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=["HS256"],
            )
            return payload.get("sub")
        except Exception as exc:
            logger.warning("JWT decode failed (dev mode)", error=str(exc))
            return None

    try:
        payload = pyjwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except pyjwt.ExpiredSignatureError:
        logger.warning("JWT expired")
        return None
    except pyjwt.InvalidTokenError as exc:
        logger.warning("JWT invalid", error=str(exc))
        return None


def _require_supabase() -> None:
    """Raise 503 if Supabase is not configured."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Database unavailable",
                "detail": "Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
            },
        )


def _require_auth(user_id: str | None) -> str:
    """Raise 401 if user_id is missing."""
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": "Unauthorized", "detail": "Valid Bearer token required"},
        )
    return user_id


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/sessions", status_code=201)
async def create_session(
    session: SessionCreate,
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Log a new surf session for the authenticated user."""
    user_id = await get_user_id(credentials)
    _require_auth(user_id)
    _require_supabase()

    client = get_client()
    record = {
        "user_id": user_id,
        **session.model_dump(exclude_none=True),
        # Convert date/datetime fields to ISO strings for Supabase
    }
    # Supabase-py handles date serialisation, but be explicit with date objects
    if "session_date" in record and hasattr(record["session_date"], "isoformat"):
        record["session_date"] = record["session_date"].isoformat()
    if "start_time" in record and hasattr(record["start_time"], "isoformat"):
        record["start_time"] = record["start_time"].isoformat()
    if "end_time" in record and hasattr(record["end_time"], "isoformat"):
        record["end_time"] = record["end_time"].isoformat()

    try:
        result = client.table("user_sessions").insert(record).execute()
        if not result.data:
            raise HTTPException(
                status_code=500,
                detail={"error": "Insert failed", "detail": "No data returned from database"},
            )
        row = result.data[0]
        logger.info("Session created", session_id=row.get("id"), user_id=user_id)
        return {"session": row}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to create session", user_id=user_id, error=str(exc))
        raise HTTPException(
            status_code=500,
            detail={"error": "Database error", "detail": "An internal error occurred"},
        )


@router.get("/sessions")
async def list_sessions(
    credentials: HTTPAuthorizationCredentials = Security(security),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Return the authenticated user's surf sessions, newest first."""
    user_id = await get_user_id(credentials)
    _require_auth(user_id)

    if not is_supabase_configured():
        logger.warning("Supabase not configured — returning empty session list")
        return {"sessions": [], "total": 0, "message": "Database not configured"}

    try:
        client = get_client()
        result = (
            client.table("user_sessions")
            .select("*")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")  # soft-delete filter (column may not exist yet, handled below)
            .order("session_date", desc=True)
            .limit(limit)
            .offset(offset)
            .execute()
        )
        sessions = result.data or []
        logger.debug("Sessions fetched", user_id=user_id, count=len(sessions))
        return {"sessions": sessions, "total": len(sessions)}
    except Exception as exc:
        # If deleted_at column doesn't exist yet, retry without that filter
        err_str = str(exc).lower()
        if "deleted_at" in err_str or "column" in err_str:
            try:
                client = get_client()
                result = (
                    client.table("user_sessions")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("session_date", desc=True)
                    .limit(limit)
                    .offset(offset)
                    .execute()
                )
                return {"sessions": result.data or [], "total": len(result.data or [])}
            except Exception as inner_exc:
                logger.error("Failed to list sessions (retry)", user_id=user_id, error=str(inner_exc))
                return {"sessions": [], "total": 0}
        logger.error("Failed to list sessions", user_id=user_id, error=str(exc))
        return {"sessions": [], "total": 0}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Return a single session by ID (must belong to the authenticated user)."""
    user_id = await get_user_id(credentials)
    _require_auth(user_id)

    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail={"error": "Database unavailable", "detail": "Supabase is not configured"},
        )

    try:
        client = get_client()
        result = (
            client.table("user_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail={"error": "Not found", "detail": f"Session {session_id} not found"},
            )
        return {"session": result.data}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch session", session_id=session_id, user_id=user_id, error=str(exc))
        raise HTTPException(
            status_code=500,
            detail={"error": "Database error", "detail": "An internal error occurred"},
        )


@router.delete("/sessions/{session_id}", status_code=200)
async def delete_session(
    session_id: str,
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Soft-delete a session by setting deleted_at (falls back to hard-delete if column absent)."""
    user_id = await get_user_id(credentials)
    _require_auth(user_id)
    _require_supabase()

    client = get_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        # Attempt soft delete
        result = (
            client.table("user_sessions")
            .update({"deleted_at": now_iso, "updated_at": now_iso})
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail={"error": "Not found", "detail": f"Session {session_id} not found or already deleted"},
            )
        logger.info("Session soft-deleted", session_id=session_id, user_id=user_id)
        return {"deleted": True, "session_id": session_id}
    except HTTPException:
        raise
    except Exception as exc:
        err_str = str(exc).lower()
        if "deleted_at" in err_str or "column" in err_str:
            # Schema doesn't have deleted_at yet — hard delete
            try:
                result = (
                    client.table("user_sessions")
                    .delete()
                    .eq("id", session_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                logger.info("Session hard-deleted (no soft-delete column)", session_id=session_id, user_id=user_id)
                return {"deleted": True, "session_id": session_id}
            except Exception as inner_exc:
                logger.error("Failed to delete session", session_id=session_id, error=str(inner_exc))
                raise HTTPException(
                    status_code=500,
                    detail={"error": "Database error", "detail": "An internal error occurred"},
                )
        logger.error("Failed to delete session", session_id=session_id, user_id=user_id, error=str(exc))
        raise HTTPException(
            status_code=500,
            detail={"error": "Database error", "detail": "An internal error occurred"},
        )
