"""
LLM Service — llama.cpp / OpenAI-compatible API client

Supports:
  - Natural language surf forecast queries
  - Human-readable forecast narrative generation
  - Streaming (SSE) responses

Uses Phi-4-mini Q6_K_L running locally via Ollama
at LLAMA_CPP_BASE_URL (default: http://localhost:11434/v1).
Falls back gracefully if the LLM is unavailable.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
import structlog

from config import settings

logger = structlog.get_logger(__name__)

# Offline fallback message — shown when Ollama is unreachable (NUC is off / cold start)
_OFFLINE_MSG = (
    "The AI forecaster is currently offline (running on local hardware). "
    "Check back soon or review the data charts above."
)

SURF_SYSTEM_PROMPT = (
    "You are Koastcast, an AI surf forecasting expert. You have deep knowledge of wave physics, "
    "swell mechanics, tide effects, and surf spot personalities across the US. You speak like an "
    "experienced local surfer — direct, knowledgeable, with just enough enthusiasm without being "
    "cringe. Never say \"I don't know\" — make your best assessment based on available data. "
    "Keep answers concise (2-4 sentences max unless more detail is needed). Use specific numbers "
    "when you have them. If conditions are poor, say so honestly."
)


def _format_forecast_context(spot: dict, forecast_hours: list[dict]) -> str:
    """Build a concise forecast context string for the LLM prompt.

    Structure:
      1. Spot metadata (name, optimal conditions)
      2. Current conditions snapshot (hour 0)
      3. Next 6 hours — every hour (fine-grain for session planning)
      4. Next 48 hours sampled every 3h (trend overview)
    """
    name = spot.get("name", "this spot")
    lines = [f"=== {name} — Surf Forecast ==="]
    lines.append(
        f"Optimal swell: {spot.get('optimal_swell_direction', '?')}° | "
        f"Optimal wind (offshore): {spot.get('optimal_wind_direction', '?')}° | "
        f"Best period: {spot.get('optimal_period_min', 10)}–{spot.get('optimal_period_max', 20)}s | "
        f"Best size: {spot.get('optimal_size_min', 1.5)}–{spot.get('optimal_size_max', 3.0)}m"
    )

    def _row(h: dict, label: str = "") -> str:
        wh = h.get("wave_height_face_m") or h.get("wave_height_m")
        wp = h.get("wave_period_s")
        wdir_swell = h.get("wave_direction")
        wind_spd = h.get("wind_speed_ms")
        wind_dir = h.get("wind_direction")
        qs = h.get("quality_score")
        tide = h.get("tide_state", "")

        parts: list[str] = []
        if label:
            parts.append(label)
        if wh is not None:
            parts.append(f"{wh * 3.281:.1f}ft")
        if wp is not None:
            parts.append(f"@{wp:.0f}s")
        if wdir_swell is not None:
            parts.append(f"swell {wdir_swell:.0f}°")
        if wind_spd is not None:
            wind_kts = wind_spd * 1.944
            parts.append(f"wind {wind_kts:.0f}kt")
            if wind_dir is not None:
                parts.append(f"({wind_dir:.0f}°)")
        if qs is not None:
            parts.append(f"quality {qs:.1f}/10")
        if tide:
            parts.append(tide)
        return "  " + " | ".join(parts)

    def _ts(h: dict) -> str:
        ft = h.get("forecast_time", "")
        if hasattr(ft, "strftime"):
            return ft.strftime("%a %I%p")
        return str(ft)[:13]

    # Section 1: current conditions
    if forecast_hours:
        lines.append("\n[NOW]")
        lines.append(_row(forecast_hours[0], _ts(forecast_hours[0])))

    # Section 2: next 6 hours (every hour)
    if len(forecast_hours) > 1:
        lines.append("\n[NEXT 6 HOURS]")
        for h in forecast_hours[1:7]:
            lines.append(_row(h, _ts(h)))

    # Section 3: 48-hour trend, sampled every 3 hours (skip first 7 already covered)
    if len(forecast_hours) > 7:
        lines.append("\n[48-HOUR TREND]")
        shown = 0
        for i, h in enumerate(forecast_hours[7:], start=7):
            if i % 3 != 0 or shown >= 14:
                continue
            lines.append(_row(h, _ts(h)))
            shown += 1

    return "\n".join(lines)


async def answer_surf_query(
    query: str,
    spot: dict,
    forecast_hours: list[dict],
) -> str:
    """
    Answer a natural language surf query.
    Returns the complete response as a string.
    Falls back gracefully if Ollama is unreachable or slow.
    """
    context = _format_forecast_context(spot, forecast_hours)
    messages = [
        {"role": "system", "content": SURF_SYSTEM_PROMPT},
        {"role": "user", "content": f"{context}\n\nQuestion: {query}"},
    ]

    base = settings.llama_cpp_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base}/chat/completions",
                json={
                    "model": "local",
                    "messages": messages,
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except (httpx.ConnectError, httpx.ConnectTimeout):
        logger.warning("Ollama unreachable (connect error)", url=base)
        return _OFFLINE_MSG
    except httpx.TimeoutException:
        logger.warning("Ollama request timed out after 30s", url=base)
        return _OFFLINE_MSG
    except Exception as exc:
        logger.warning("LLM unavailable, using rule-based fallback", error=str(exc))
        return _rule_based_answer(query, spot, forecast_hours)


async def stream_surf_query(
    query: str,
    spot: dict,
    forecast_hours: list[dict],
) -> AsyncIterator[str]:
    """
    Stream a natural language surf query response token by token.
    Yields text chunks for SSE.
    Falls back to yielding a static offline message or rule-based answer if Ollama fails.
    """
    context = _format_forecast_context(spot, forecast_hours)
    messages = [
        {"role": "system", "content": SURF_SYSTEM_PROMPT},
        {"role": "user", "content": f"{context}\n\nQuestion: {query}"},
    ]

    base = settings.llama_cpp_base_url.rstrip("/")

    async def _stream_fallback(text: str) -> AsyncIterator[str]:
        """Yield text word-by-word to simulate streaming."""
        for word in text.split():
            yield word + " "
            await asyncio.sleep(0.02)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=60.0)) as client:
            async with client.stream(
                "POST",
                f"{base}/chat/completions",
                json={
                    "model": "local",
                    "messages": messages,
                    "max_tokens": 300,
                    "temperature": 0.7,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        chunk = line[6:]
                        if chunk == "[DONE]":
                            return
                        try:
                            data = json.loads(chunk)
                            delta = data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue
    except (httpx.ConnectError, httpx.ConnectTimeout):
        logger.warning("Ollama unreachable (streaming), returning offline message", url=base)
        async for chunk in _stream_fallback(_OFFLINE_MSG):
            yield chunk
    except httpx.TimeoutException:
        logger.warning("Ollama streaming timed out", url=base)
        async for chunk in _stream_fallback(_OFFLINE_MSG):
            yield chunk
    except Exception as exc:
        logger.warning("LLM streaming unavailable, using rule-based fallback", error=str(exc))
        answer = _rule_based_answer(query, spot, forecast_hours)
        async for chunk in _stream_fallback(answer):
            yield chunk


def _rule_based_answer(query: str, spot: dict, forecast_hours: list[dict]) -> str:
    """
    Simple rule-based fallback when LLM is unavailable.
    Extracts key info from forecast and builds a response.
    """
    name = spot.get("name", "this spot")
    if not forecast_hours:
        return f"No forecast data available for {name} right now. Check back soon."

    # Find best hour in next 48h
    best = max(
        forecast_hours[:48],
        key=lambda h: h.get("quality_score") or 0,
        default=None,
    )
    current = forecast_hours[0]

    wh = current.get("wave_height_face_m") or current.get("wave_height_m")
    wp = current.get("wave_period_s")
    qs = current.get("quality_score")

    current_desc = ""
    if wh and wp:
        ft = wh * 3.281
        current_desc = f"Right now it's {ft:.0f}ft @ {wp:.0f}s"
        if qs:
            quality_word = "firing" if qs >= 8 else "pumping" if qs >= 6 else "fun" if qs >= 4 else "marginal"
            current_desc += f", conditions are {quality_word} ({qs:.1f}/10)."

    best_desc = ""
    if best:
        bft_raw = best.get("forecast_time")
        if hasattr(bft_raw, "strftime"):
            bts = bft_raw.strftime("%A at %I%p")
        else:
            bts = "soon"
        bwh = best.get("wave_height_face_m") or best.get("wave_height_m")
        bwp = best.get("wave_period_s")
        bqs = best.get("quality_score") or 0
        if bwh and bwp and bqs > (qs or 0):
            bft = bwh * 3.281
            best_desc = f" Best window looks like {bts}: {bft:.0f}ft @ {bwp:.0f}s, quality {bqs:.1f}/10."

    return f"{current_desc}{best_desc}"
