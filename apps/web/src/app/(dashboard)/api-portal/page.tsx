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
        <h1 className="text-2xl font-bold text-white mb-2">API Portal</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center mt-6">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-white mb-2">Explorer Tier Required</h2>
          <p className="text-gray-400 text-sm mb-4">
            B2B API access is available on the Explorer plan. Get programmatic access to
            SwellStack forecasts for your app or research.
          </p>
          <a
            href="/upgrade"
            className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
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
        <h1 className="text-2xl font-bold text-white">API Portal</h1>
        <p className="text-gray-400 text-sm mt-1">
          Programmatic access to SwellStack surf forecasts.
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
        <div className="bg-green-950/50 border border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-semibold">New API Key — copy now!</span>
            <span className="text-green-600 text-xs">Shown only once</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-green-300 text-xs font-mono break-all">
              {newKey}
            </code>
            <button
              onClick={copyKey}
              className="flex-shrink-0 bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-2 rounded-lg transition-colors"
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">API Keys</h2>
          <button
            onClick={generateKey}
            disabled={generating || keys.length >= 3}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {generating ? 'Generating...' : '+ New Key'}
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map(i => <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {keys.map(key => (
              <div key={key.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <code className="text-gray-300 text-sm font-mono">{key.key_prefix}•••••••••</code>
                  <div className="text-gray-500 text-xs mt-0.5">
                    Created {new Date(key.created_at).toLocaleDateString()} ·
                    {key.last_used_at ? ` Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ' Never used'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-gray-400 text-xs">
                    {key.requests_this_month}/{key.monthly_limit}
                  </div>
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="text-red-500 hover:text-red-400 text-xs mt-0.5 transition-colors"
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Quick Start</h2>
        <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
{`curl http://localhost:8000/api/v1/forecast/mavericks-ca \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response: 7-day hourly forecast with wave height, period,
# direction, wind, tide, quality score, crowd prediction
# FUTURE INTEGRATION: Cloudflare Tunnel — replace localhost:8000 with https://api.swellstack.io`}
        </pre>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-xs mt-2 block transition-colors"
        >
          View full API documentation →
        </a>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  )
}
