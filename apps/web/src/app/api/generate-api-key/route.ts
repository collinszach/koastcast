/**
 * POST /api/generate-api-key — Generate a new B2B API key for Explorer users.
 * Stores only the SHA-256 hash in the database; returns the raw key once.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import crypto from 'crypto'

function generateApiKey(): string {
  // Format: koastcast_<32 random hex bytes>
  const random = crypto.randomBytes(32).toString('hex')
  return `koastcast_${random}`
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Explorer tier
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('subscription_tier')
    .eq('user_id', user.id)
    .single()

  if (profile?.subscription_tier !== 'explorer') {
    return NextResponse.json(
      { error: 'B2B API access requires Explorer tier' },
      { status: 403 },
    )
  }

  // Max 3 keys per user
  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('revoked', false)

  if ((count || 0) >= 3) {
    return NextResponse.json({ error: 'Maximum 3 API keys allowed' }, { status: 429 })
  }

  const rawKey = generateApiKey()
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 20)

  const { error } = await supabase.from('api_keys').insert({
    user_id: user.id,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    tier: 'explorer',
    monthly_limit: 10_000,
    requests_this_month: 0,
    revoked: false,
  })

  if (error) {
    console.error('Failed to create API key:', error)
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }

  // Return full key ONCE — never stored in plaintext
  return NextResponse.json({ key: rawKey, prefix: keyPrefix })
}
