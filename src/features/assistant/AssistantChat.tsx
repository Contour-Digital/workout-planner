import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { IconSend, IconSparkle, IconX } from '../../components/ui/icons'
import { sendAssistantMessage, type AssistantContext, type AssistantMessage, type AssistantSuggestion } from '../../lib/assistantChat'

interface StoredMessage extends AssistantMessage {
  id: string
  suggestions?: AssistantSuggestion[]
  addedNames?: string[]
}

interface AssistantChatProps {
  /** Unique per conversation (e.g. a routine id or a workout session id) — history is
   *  kept separately per key, in sessionStorage, so it clears when the app is closed. */
  storageKey: string
  /** Called fresh each send so the assistant always sees the current draft/session state. */
  buildContext: () => AssistantContext
  /** Omit to hide "Add" buttons on suggestions (not every context can act on them). */
  onAddSuggestion?: (suggestion: AssistantSuggestion) => Promise<void>
  /** Applied to the trigger — the caller places it in its own bottom bar layout. Not
   *  used when `floating` is set, since the trigger positions itself. */
  className?: string
  /** Shown as a chat bubble before the first message — tailored to wherever this
   *  instance was opened from (building a routine vs. mid-workout), so it's clear
   *  what Spot can actually help with here. */
  greeting: string
  /** Renders the trigger as a small floating round icon button (fixed bottom-right)
   *  instead of an inline "Spot" button — for pages with no natural bottom-bar slot
   *  to place an inline trigger in (Dashboard, the Workouts list). */
  floating?: boolean
  /** Tappable shortcuts shown alongside the greeting, before the first message — for
   *  things Spot's own chat can't do inline (e.g. opening the from-notes generator). */
  quickActions?: { label: string; onClick: () => void }[]
}

function historyKey(key: string): string {
  return `assistant-chat:${key}`
}

function loadHistory(key: string): StoredMessage[] {
  try {
    const raw = sessionStorage.getItem(historyKey(key))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(key: string, messages: StoredMessage[]) {
  try {
    sessionStorage.setItem(historyKey(key), JSON.stringify(messages))
  } catch {
    // storage full or unavailable (e.g. private browsing) — conversation just won't persist
  }
}

export function AssistantChat({ storageKey, buildContext, onAddSuggestion, className, greeting, floating, quickActions }: AssistantChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<StoredMessage[]>(() => loadHistory(storageKey))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(loadHistory(storageKey))
  }, [storageKey])

  useEffect(() => {
    saveHistory(storageKey, messages)
  }, [storageKey, messages])

  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)

    const userMessage: StoredMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const history: AssistantMessage[] = nextMessages.map(({ role, content }) => ({ role, content }))
      const result = await sendAssistantMessage(history, buildContext())
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: result.reply, suggestions: result.suggestions, addedNames: [] },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(messageId: string, suggestion: AssistantSuggestion) {
    if (!onAddSuggestion) return
    await onAddSuggestion(suggestion)
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, addedNames: [...(m.addedNames ?? []), suggestion.name] } : m)),
    )
  }

  return (
    <>
      {floating ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Spot, your training assistant"
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:bg-accent-strong sm:bottom-8 sm:right-8"
        >
          <IconSparkle width={24} height={24} />
        </button>
      ) : (
        <Button variant="secondary" icon={<IconSparkle width={18} height={18} />} onClick={() => setOpen(true)} className={className}>
          Spot
        </Button>
      )}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Spot, your training assistant"
              className="relative z-10 flex h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:h-[70vh] sm:max-w-lg sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-primary-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <IconSparkle width={18} height={18} className="text-secondary" />
                  <div>
                    <h2 className="text-lg font-semibold text-primary-strong">Spot</h2>
                    <p className="text-xs text-primary-muted">Your training assistant</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-primary-tint"
                >
                  <IconX width={18} height={18} />
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-start gap-2">
                    <div className="max-w-[85%] rounded-2xl bg-primary-tint px-3.5 py-2.5 text-sm text-primary-strong">{greeting}</div>
                    {quickActions && quickActions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {quickActions.map((action) => (
                          <button
                            key={action.label}
                            onClick={action.onClick}
                            className="rounded-full border border-secondary px-3 py-1.5 text-xs font-medium text-secondary hover:bg-secondary-tint"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {messages.map((m) => (
                    <div key={m.id} className={clsx('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
                      <div
                        className={clsx(
                          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                          m.role === 'user' ? 'bg-secondary text-white' : 'bg-primary-tint text-primary-strong',
                        )}
                      >
                        {m.content}
                      </div>
                      {m.suggestions && m.suggestions.length > 0 && (
                        <div className="flex w-full max-w-[85%] flex-col gap-2">
                          {m.suggestions.map((s) => {
                            const added = m.addedNames?.includes(s.name)
                            return (
                              <div
                                key={s.name}
                                className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-primary-border bg-surface-muted px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-primary-strong">{s.name}</p>
                                  <p className="truncate text-xs text-primary-muted">{s.reason}</p>
                                </div>
                                {onAddSuggestion && (
                                  <Button size="sm" variant={added ? 'ghost' : 'secondary'} disabled={added} onClick={() => handleAdd(m.id, s)}>
                                    {added ? 'Added' : 'Add'}
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-1 self-start rounded-2xl bg-primary-tint px-3.5 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-muted" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-muted" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-muted" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="px-4 pb-1 text-xs text-danger">{error}</p>}

              <div className="flex items-center gap-2 border-t border-primary-border p-3">
                <input
                  className="flex-1 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
                  placeholder="Ask the assistant…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  disabled={loading}
                />
                <Button size="sm" icon={<IconSend width={16} height={16} />} disabled={!input.trim() || loading} onClick={handleSend}>
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
