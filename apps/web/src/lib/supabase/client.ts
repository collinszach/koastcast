'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return url.includes('.supabase.co') && key.length > 20 && !key.includes('placeholder')
}

// Stub auth that returns safe no-ops when Supabase is not configured.
// All methods match the shape of the real Supabase auth client so callers
// don't need to guard every call.
const stubAuth = {
  getUser: async () => ({ data: { user: null }, error: null }),
  getSession: async () => ({ data: { session: null }, error: null }),
  signInWithOtp: async (_opts: unknown) =>
    ({ error: { message: 'Auth not configured' } } as { error: { message: string } }),
  signInWithPassword: async (_opts: unknown) =>
    ({
      data: { user: null, session: null },
      error: { message: 'Auth not configured' },
    } as { data: { user: null; session: null }; error: { message: string } }),
  signUp: async (_opts: unknown) =>
    ({
      data: { user: null, session: null },
      error: { message: 'Auth not configured' },
    } as { data: { user: null; session: null }; error: { message: string } }),
  signOut: async () => ({ error: null }),
  signInWithOAuth: async (_opts: unknown) =>
    ({ data: null, error: { message: 'Auth not configured' } } as {
      data: null
      error: { message: string }
    }),
  onAuthStateChange: (
    _callback: unknown,
  ): { data: { subscription: { unsubscribe: () => void } } } => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
}

// Stub from() chain — covers the most common query patterns used in the codebase.
function stubFrom() {
  return {
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: null }),
        limit: () => ({ data: [], error: null }),
      }),
      order: () => ({ data: [], error: null }),
      limit: () => ({ data: [], error: null }),
    }),
    upsert: async () => ({ error: null }),
    insert: async () => ({ data: null, error: null }),
    update: () => ({ eq: async () => ({ error: null }) }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  }
}

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!isSupabaseConfigured()) {
    // Return a typed stub so components don't crash when Supabase isn't configured
    return {
      auth: stubAuth,
      from: stubFrom,
    } as unknown as SupabaseClient
  }

  return createBrowserClient(url!, key!)
}
