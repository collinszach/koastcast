/**
 * POST /api/checkout — Create a Stripe Checkout session.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const priceId = formData.get('price_id') as string

  if (!priceId) {
    return NextResponse.json({ error: 'price_id required' }, { status: 400 })
  }

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env.' },
      { status: 503 },
    )
  }

  // Get authenticated user
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
    return NextResponse.redirect(new URL('/login?next=/upgrade', request.url))
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, stripe_customer_id: customerId })
  }

  const origin = new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/upgrade?success=1`,
    cancel_url: `${origin}/upgrade?canceled=1`,
    metadata: { user_id: user.id },
  })

  return NextResponse.redirect(session.url!, 303)
}
