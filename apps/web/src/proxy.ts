import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth disabled — pass all requests through
export async function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
