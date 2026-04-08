/**
 * POST /api/webhook/stripe — Handle Stripe webhook events.
 * Updates user subscription tier in Supabase.
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PRICE_TIER_MAP: Record<string, string> = {
  [process.env.STRIPE_PRO_PRICE_ID || '']: 'pro',
  [process.env.STRIPE_EXPLORER_PRICE_ID || '']: 'explorer',
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  })

  // Use service role key for webhook — bypasses RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.metadata?.user_id) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          const priceId = lineItems.data[0]?.price?.id
          const tier = PRICE_TIER_MAP[priceId || ''] || 'pro'

          await supabase
            .from('user_profiles')
            .upsert({
              user_id: session.metadata.user_id,
              subscription_tier: tier,
              stripe_customer_id: session.customer as string,
            })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price?.id

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          const newTier = PRICE_TIER_MAP[priceId || ''] || 'pro'
          const tier = sub.status === 'active' ? newTier : 'free'

          await supabase
            .from('user_profiles')
            .update({ subscription_tier: tier })
            .eq('user_id', profile.user_id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase
            .from('user_profiles')
            .update({ subscription_tier: 'free' })
            .eq('user_id', profile.user_id)
        }
        break
      }

      default:
        // Ignore other events
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
