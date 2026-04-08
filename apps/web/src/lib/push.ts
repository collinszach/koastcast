/**
 * Web Push notification utilities.
 *
 * Flow:
 *   1. Register service worker (sw.js)
 *   2. Subscribe to push with VAPID public key
 *   3. Save PushSubscription to user_profiles via Supabase
 *   4. Backend sends push via Supabase Edge Function
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (err) {
    console.error('SW registration failed:', err)
    return null
  }
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID_PUBLIC_KEY not set — push notifications disabled')
    return null
  }

  try {
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    })
    return subscription
  } catch (err) {
    console.error('Push subscription failed:', err)
    return null
  }
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const subJson = subscription.toJSON()

  await supabase.from('user_profiles').upsert({
    user_id: user.id,
    push_subscription: JSON.stringify(subJson),
    updated_at: new Date().toISOString(),
  })
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.permission === 'default'
    ? Notification.requestPermission()
    : Notification.permission
}

/**
 * Full setup: register SW, request permission, subscribe, save.
 * Returns true if push is set up successfully.
 */
export async function setupPushNotifications(): Promise<boolean> {
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return false

  const reg = await registerServiceWorker()
  if (!reg) return false

  const sub = await subscribeToPush(reg)
  if (!sub) return false

  await savePushSubscription(sub)
  return true
}
