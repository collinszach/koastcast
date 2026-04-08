/**
 * POST /api/nlq/stream — Proxy streaming NLQ to NUC backend.
 * Passes through SSE events from FastAPI to the browser.
 */
import { NextRequest } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

// Simple in-memory rate limiter (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true // allowed
  }

  if (record.count >= maxRequests) return false // blocked

  record.count++
  return true // allowed
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  if (!checkRateLimit(ip, 10, 60000)) { // 10 requests per minute per IP
    return new Response(
      `data: ${JSON.stringify({ token: 'Rate limit exceeded. Please wait a moment.' })}\n\ndata: [DONE]\n\n`,
      {
        status: 429,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      },
    )
  }

  const body = await request.json()

  // Attach auth header for rate limiting on NUC side
  const upstreamRes = await fetch(`${NUC_BASE}/api/v1/nlq/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Secret': NUC_SECRET,
    },
    body: JSON.stringify(body),
  })

  if (!upstreamRes.ok || !upstreamRes.body) {
    return new Response(
      `data: ${JSON.stringify({ token: 'AI forecaster unavailable right now.' })}\n\ndata: [DONE]\n\n`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      },
    )
  }

  // Pass through the SSE stream directly
  return new Response(upstreamRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
