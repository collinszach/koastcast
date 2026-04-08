/**
 * POST /api/nlq/stream — Proxy streaming NLQ to NUC backend.
 * Passes through SSE events from FastAPI to the browser.
 *
 * Edge Runtime: no execution timeout (Serverless Functions have a 10s hard
 * limit on Vercel Hobby, which kills Ollama responses that take 20–60s).
 * Rate limiting is delegated to the NUC backend (FastAPI middleware).
 */
export const runtime = 'edge'

import { NextRequest } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

const SSE_UNAVAILABLE = (msg: string) =>
  new Response(
    `data: ${JSON.stringify({ token: msg })}\n\ndata: [DONE]\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
  )

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return SSE_UNAVAILABLE('Invalid request.')
  }

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(`${NUC_BASE}/api/v1/nlq/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Secret': NUC_SECRET,
      },
      body: JSON.stringify(body),
    })
  } catch {
    return SSE_UNAVAILABLE('AI forecaster is offline right now — check back soon.')
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    return SSE_UNAVAILABLE('AI forecaster unavailable right now.')
  }

  // Pass the SSE stream straight through to the browser
  return new Response(upstreamRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
