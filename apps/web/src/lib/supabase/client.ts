'use client'

import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_KEY)

export function createClient() {
  if (!isSupabaseConfigured) {
    // Return a stub so components don't crash when Supabase isn't configured
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithOtp: async () => ({ error: { message: 'Supabase not configured' } }),
        signInWithOAuth: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ error: null }),
        insert: async () => ({ data: null, error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    } as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(SUPABASE_URL!, SUPABASE_KEY!)
}
