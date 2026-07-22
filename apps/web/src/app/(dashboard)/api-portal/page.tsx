'use client'

/**
 * API Portal — B2B API key management for Explorer tier users.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ApiKey {
  id: string
  key_prefix: string
  created_at: string
  requests_this_month: number
  monthly_limit: number
  last_used_at: string | null
}

export default function ApiPortalPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [tier, setTier] = useState<string>('free')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .single()

      setTier(profile?.subscription_tier || 'free')

      const { data: apiKeys } = await supabase
        .from('api_keys')
        .select('id, key_prefix, created_at, requests_this_month, monthly_limit, last_used_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setKeys(apiKeys || [])
      setLoading(false)
    }
    load()
  }, [])

  async function generateKey() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-api-key', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate key')
      const data = await res.json()
      setNewKey(data.key)

      // Refresh key list
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: apiKeys } = await supabase
          .from('api_keys')
          .select('id, key_prefix, created_at, requests_this_month, monthly_limit, last_used_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        setKeys(apiKeys || [])
      }
    } catch (err) {
      alert('Failed to generate API key')
    } finally {
      setGenerating(false)
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('api_keys').update({ revoked: true }).eq('id', keyId)
    setKeys(prev => prev.filter(k => k.id !== keyId))
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (tier !== 'explorer') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--foam)] mb-2">API Portal</h1>
        <div className="tile rounded-2xl p-8 text-center mt-6">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-[var(--foam)] mb-2">Explorer Tier Required</h2>
          <p className="text-[var(--spray)] text-sm mb-4">
            B2B API access is available on the Explorer plan. Get programmatic access to
            Koastcast forecasts for your app or research.
          </p>
          <a
            href="/upgrade"
            className="btn-ocean inline-block"
            style={{ background: 'var(--amber)' }}
          >
            Upgrade to Explorer
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foam)]">API Portal</h1>
        <p className="text-[var(--spray)] text-sm mt-1">
          Programmatic access to Koastcast surf forecasts.
        </p>
      </div>

      {/* Usage stats */}
      {keys.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Requests today"
            value={keys[0].requests_this_month.toLocaleString()}
          />
          <StatCard
            label="Monthly limit"
            value={keys[0].monthly_limit.toLocaleString()}
          />
        </div>
      )}

      {/* New key display (shown once) */}
      {newKey && (
        <div className="rounded-xl p-4 bg-green-50 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-700 text-sm font-semibold">New API Key — copy now!</span>
            <span className="text-green-600 text-xs">Shown only once</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[var(--paper-sunken)] border border-[var(--tile-border-strong)] rounded-lg px-3 py-2 text-green-700 text-xs font-mono break-all">
              {newKey}
            </code>
            <button
              onClick={copyKey}
              className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="text-green-700 text-xs mt-2">
            Add to requests: <code>Authorization: Bearer {newKey.slice(0, 20)}...</code>
          </p>
        </div>
      )}

      {/* Key list */}
      <div className="tile rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--tile-border)]">
          <h2 className="text-sm font-semibold text-[var(--mist)]">API Keys</h2>
          <button
            onClick={generateKey}
            disabled={generating || keys.length >= 3}
            className="btn-ocean disabled:opacity-50"
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            {generating ? 'Generating...' : '+ New Key'}
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map(i => <div key={i} className="h-12 skeleton" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-[var(--spray)] text-sm">
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          <div className="divide-y divide-[var(--tile-border)]">
            {keys.map(key => (
              <div key={key.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <code className="text-[var(--mist)] text-sm font-mono">{key.key_prefix}•••••••••</code>
                  <div className="text-[var(--spray)] text-xs mt-0.5">
                    Created {new Date(key.created_at).toLocaleDateString()} ·
                    {key.last_used_at ? ` Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ' Never used'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[var(--spray)] text-xs">
                    {key.requests_this_month}/{key.monthly_limit}
                  </div>
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="text-red-600 hover:text-red-500 text-xs mt-0.5 transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API docs link */}
      <div className="tile rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[var(--mist)] mb-3">Quick Start</h2>
        <pre className="bg-[var(--paper-sunken)] rounded-lg p-3 text-xs text-[var(--mist)] overflow-x-auto">
{`curl https://api.koastcast.com/api/v1/forecast/mavericks-ca \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response: 7-day hourly forecast with wave height, period,
# direction, wind, tide, quality score, crowd prediction`}
        </pre>
        <a
          href="https://api.koastcast.com/api/v1/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--cyan-bright)] hover:text-[var(--cyan)] text-xs mt-2 block transition-colors"
        >
          View full API documentation →
        </a>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile rounded-xl p-4">
      <div className="text-xs text-[var(--spray)] mb-1">{label}</div>
      <div className="text-xl font-bold text-[var(--foam)]">{value}</div>
    </div>
  )
}
