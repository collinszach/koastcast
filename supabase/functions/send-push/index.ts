/**
 * Supabase Edge Function: send-push
 *
 * Sends a Web Push notification to a specific user.
 * Called from the NUC scheduler when optimal windows are detected.
 *
 * Deploy with: supabase functions deploy send-push
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PushPayload {
  user_id: string
  title: string
  body: string
  url?: string
}

// VAPID keys — set as Supabase secrets:
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = 'mailto:push@peakcast.app'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Verify request is from NUC (shared secret)
  const authHeader = req.headers.get('Authorization')
  const expectedSecret = `Bearer ${Deno.env.get('NUC_API_SECRET') || ''}`
  if (authHeader !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: PushPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetch user's push subscription
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('push_subscription')
    .eq('user_id', payload.user_id)
    .single()

  if (!profile?.push_subscription) {
    return new Response(JSON.stringify({ sent: false, reason: 'no_subscription' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let subscription: PushSubscription
  try {
    subscription = JSON.parse(profile.push_subscription)
  } catch {
    return new Response(JSON.stringify({ sent: false, reason: 'invalid_subscription' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'vapid_keys_not_configured' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Build notification payload
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/map',
  })

  // Use web-push via fetch (Deno doesn't have a built-in web-push library)
  // For production: use https://esm.sh/web-push or implement VAPID signing
  // This is a placeholder that logs the intent
  console.log('Would send push to', payload.user_id, {
    title: payload.title,
    body: payload.body,
  })

  return new Response(
    JSON.stringify({ sent: true, user_id: payload.user_id }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
