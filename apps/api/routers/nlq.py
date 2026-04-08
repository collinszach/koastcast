"""
Natural Language Query router
POST /api/v1/nlq → answer surf questions with on-device LLM (Phi-4-mini)
Supports both regular JSON and SSE streaming responses.
"""
from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from models.schemas import NLQRequest, NLQResponse
from services.llm import answer_surf_query, stream_surf_query

router = APIRouter()


@router.post("/nlq", response_model=NLQResponse)
async def natural_language_query(request: NLQRequest) -> NLQResponse:
    """
    Answer a natural language surf question.
    Returns a complete JSON response.
    """
    spot: dict = {}
    forecast_hours: list[dict] = []

    if request.spot_id:
        try:
            from db.supabase_client import get_spot_by_slug, get_spot_by_id
            from routers.forecast import get_forecast

            db_spot = await get_spot_by_slug(request.spot_id)
            if db_spot is None:
                db_spot = await get_spot_by_id(request.spot_id)

            if db_spot:
                spot = {
                    "name": db_spot.name,
                    "optimal_swell_direction": db_spot.optimal_swell_direction,
                    "optimal_wind_direction": db_spot.optimal_wind_direction,
                }
                fc = await get_forecast(spot_id=request.spot_id, days=3)
                forecast_hours = [h.model_dump() for h in fc.hours]
        except Exception:
            pass

    answer = await answer_surf_query(
        query=request.query,
        spot=spot,
        forecast_hours=forecast_hours,
    )

    return NLQResponse(
        query=request.query,
        answer=answer,
        spot=spot.get("name"),
        confidence=0.8 if spot else 0.3,
    )


@router.post("/nlq/stream")
async def natural_language_query_stream(request: NLQRequest) -> StreamingResponse:
    """
    Stream a natural language surf answer token-by-token via SSE.

    Response format: text/event-stream
      data: {"token": "some text"}\n\n
      data: [DONE]\n\n
    """
    spot: dict = {}
    forecast_hours: list[dict] = []

    if request.spot_id:
        try:
            from db.supabase_client import get_spot_by_slug, get_spot_by_id
            from routers.forecast import get_forecast

            db_spot = await get_spot_by_slug(request.spot_id)
            if db_spot is None:
                db_spot = await get_spot_by_id(request.spot_id)

            if db_spot:
                spot = {
                    "name": db_spot.name,
                    "optimal_swell_direction": db_spot.optimal_swell_direction,
                    "optimal_wind_direction": db_spot.optimal_wind_direction,
                }
                fc = await get_forecast(spot_id=request.spot_id, days=3)
                forecast_hours = [h.model_dump() for h in fc.hours]
        except Exception:
            pass

    async def event_generator():
        async for chunk in stream_surf_query(request.query, spot, forecast_hours):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
