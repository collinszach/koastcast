'use client'

/**
 * AskPeak — Natural language surf forecast chat.
 * Streams responses from the NUC LLM via SSE.
 * Premium gate: pro/explorer only. Free users see teaser.
 */

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface AskPeakProps {
  spotId: string
  spotName: string
  isPremium?: boolean
}

const SUGGESTED_QUESTIONS = (spotName: string) => [
  `Is it worth the drive to ${spotName} tomorrow morning?`,
  'What time is the best window today?',
  'How does this compare to last week?',
]

export default function AskPeak({ spotId, spotName, isPremium = true }: AskPeakProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(query: string) {
    if (!query.trim() || loading) return

    const userMsg: Message = { role: 'user', content: query }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const assistantMsgId = Date.now()
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch('/api/nlq/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, spot_id: spotId }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Stream failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            accumulated += parsed.token || ''
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: accumulated, streaming: true }
              }
              return updated
            })
          } catch {
            // skip malformed chunks
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, streaming: false }
        }
        return updated
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: 'Stoke AI is temporarily unavailable. Try again in a moment.',
            streaming: false,
          }
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 text-[var(--foam)] font-semibold px-4 py-3 rounded-2xl shadow-2xl transition-all flex items-center gap-2 text-sm hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', boxShadow: '0 8px 32px rgba(14,165,233,0.4)' }}
      >
        <span className="text-base">🌊</span> Ask AI
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 sm:w-96 flex flex-col shadow-2xl rounded-2xl overflow-hidden"
         style={{ background: '#0c1a2e', border: '1px solid rgba(14,165,233,0.25)', boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(14,165,233,0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80"
           style={{ background: 'rgba(14,165,233,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
               style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)' }}>
            🌊
          </div>
          <div>
            <div className="text-[var(--foam)] text-sm font-bold">Ask Stoke AI</div>
            <div className="text-slate-500 text-xs">{spotName} · on-device Phi-4</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-[var(--foam)] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-all text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-72">
        {messages.length === 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-slate-500 text-xs text-center mb-3">Try asking:</p>
            {SUGGESTED_QUESTIONS(spotName).map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="w-full text-left text-xs text-slate-400 hover:text-[var(--foam)] px-3 py-2.5 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: 'var(--tile-border)', border: '1px solid var(--tile-border)' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2.5 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-[var(--foam)]'
                  : 'text-slate-200'
              }`}
              style={msg.role === 'user'
                ? { background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)' }
                : { background: 'var(--tile-border)', border: '1px solid var(--tile-border)' }
              }
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-sky-400 ml-0.5 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800/80 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask about surf conditions..."
          disabled={loading}
          className="flex-1 rounded-xl px-3 py-2 text-[var(--foam)] text-xs placeholder-slate-600 focus:outline-none disabled:opacity-50"
          style={{ background: 'var(--tile-border)', border: '1px solid var(--tile-border-strong)' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="disabled:opacity-40 text-[var(--foam)] px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: loading ? '#334155' : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)' }}
        >
          {loading ? '···' : '↑'}
        </button>
      </div>
    </div>
  )
}
