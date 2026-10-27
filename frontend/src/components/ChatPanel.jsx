import { useState, useRef, useEffect } from 'react'
import { sendMessage } from '../api/assistant'
import LoadingSpinner from './LoadingSpinner'

const ROUTE_BADGE = {
  kb:   { label: 'Knowledge Base', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  tool: { label: 'Tool Call',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  both: { label: 'KB + Tool',      cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' },
  none: { label: 'Out of scope',   cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
}

function EvidenceChips({ evidence }) {
  if (!evidence?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {evidence.map((e) => (
        <span key={e.docId} title={e.snippet}
          className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 cursor-help">
          📄 {e.title} · {e.score}
        </span>
      ))}
    </div>
  )
}

function ToolCallBadges({ toolCalls }) {
  if (!toolCalls?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {toolCalls.map((tc, i) => (
        <span key={i}
          className={`text-xs px-2 py-0.5 rounded-full border font-mono
            ${tc.error
              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
              : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'}`}>
          ⚙ {tc.name}{tc.error ? ' ✗' : ' ✓'}
        </span>
      ))}
    </div>
  )
}

function MessageBubble({ msg, onConfirm, onCancel }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {msg.content}
        </div>
      </div>
    )
  }

  const badge = ROUTE_BADGE[msg.route] || ROUTE_BADGE.none

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-1">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 dark:text-gray-100 shadow-sm whitespace-pre-wrap leading-relaxed">
          {msg.content}
        </div>
        <EvidenceChips evidence={msg.evidence} />
        <ToolCallBadges toolCalls={msg.toolCalls} />

        {msg.needsConfirmation && !msg.confirmed && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => onConfirm(msg)}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors">
              Confirm Delete
            </button>
            <button onClick={() => onCancel(msg)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
              Cancel
            </button>
          </div>
        )}
        {msg.confirmed === true  && <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Confirmed and executed</p>}
        {msg.confirmed === false && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">✗ Cancelled</p>}
      </div>
    </div>
  )
}

export default function ChatPanel({ sessionId, onTaskMutation }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I can help you manage tasks and answer questions about how our team works. Try "Show my high priority tasks" or "What does medium priority mean?"',
      route: 'none',
      evidence: [],
      toolCalls: [],
      needsConfirmation: false,
    },
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    const idempotencyKey = `${sessionId}-${Date.now()}`

    try {
      const res = await sendMessage({ message: text, sessionId, idempotencyKey })
      const assistantMsg = {
        id:                `${Date.now()}-resp`,
        role:              'assistant',
        content:           res.answer,
        route:             res.route,
        evidence:          res.evidence,
        toolCalls:         res.toolCalls,
        needsConfirmation: res.needsConfirmation,
        pendingActionId:   res.pendingActionId,
        confirmed:         undefined,
      }
      setMessages(prev => [...prev, assistantMsg])

      const mutated = res.toolCalls?.some(tc =>
        ['create_task', 'update_task', 'delete_task'].includes(tc.name) && !tc.error
      )
      if (mutated) onTaskMutation?.()

    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleConfirm(msg) {
    setLoading(true)
    setError('')
    try {
      const res = await sendMessage({
        message:         'confirmed',
        sessionId,
        confirm:         true,
        pendingActionId: msg.pendingActionId,
      })
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, confirmed: true } : m)
      )
      setMessages(prev => [...prev, {
        id:       `${Date.now()}-confirm`,
        role:     'assistant',
        content:  res.answer,
        route:    res.route,
        evidence: [],
        toolCalls: res.toolCalls,
        needsConfirmation: false,
      }])
      onTaskMutation?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleCancel(msg) {
    setMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, confirmed: false } : m)
    )
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">AI Assistant</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onConfirm={handleConfirm} onCancel={handleCancel} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 shadow-sm">
              <LoadingSpinner size="sm" />
            </div>
          </div>
        )}
        {error && <div className="text-xs text-red-500 dark:text-red-400 text-center">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about tasks or team policies..."
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent max-h-28 scrollbar-thin"
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
      </form>
    </div>
  )
}
