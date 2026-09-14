import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Loader2, MessageSquare, Send } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { fetchConversations, sendMessage } from '../../utils/messages'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

/**
 * One conversation and a box to answer it.
 *
 * The box disappears once Instagram's 24-hour window has passed rather than
 * failing on send: a reply typed into a box that cannot send it is worse than
 * no box, because the work is only lost after it is done.
 */
function Thread({ conversation, ago, onSent, notify }) {
  const { t } = useLanguage()
  const c = t.inbox.dm
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const send = async () => {
    const text = draft.trim()
    if (!text) return

    setSending(true)
    setError(null)
    try {
      await sendMessage({
        recipientId: conversation.participant?.id,
        text,
        accountId: conversation.accountId,
      })
      setDraft('')
      onSent(conversation.id, text)
      notify(c.sent)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-extrabold">@{conversation.participant?.username ?? '—'}</span>
        <span className="text-xs font-semibold text-slate-400">{ago(conversation.lastAt)}</span>
        {conversation.answered ? (
          <span className="chip bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={12} strokeWidth={2.5} />
            {c.answered}
          </span>
        ) : (
          <span className="chip bg-amber-50 text-amber-700">
            <MessageSquare size={12} strokeWidth={2.5} />
            {c.waiting}
          </span>
        )}
        <span className="text-[11px] font-semibold text-slate-400">
          @{conversation.accountUsername}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {conversation.messages.map((message) => (
          <li key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
            <span
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${
                message.mine
                  ? 'bg-brand-50 text-brand-900'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {message.text}
            </span>
          </li>
        ))}
      </ul>

      {conversation.canReply ? (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
              placeholder={fill(c.replyPlaceholder, {
                username: conversation.participant?.username ?? '',
              })}
              className="field flex-1 resize-y !py-2 text-[14px]"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="btn-primary shrink-0 !px-4 !py-2.5 !text-[14px]"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
              ) : (
                <Send size={16} strokeWidth={2.5} />
              )}
              {c.reply}
            </button>
          </div>

          {/* Stated rather than left to be discovered when it stops working. */}
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Clock size={11} strokeWidth={2.5} />
            {fill(c.hoursLeft, { n: conversation.hoursLeft })}
          </p>
        </>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <Clock size={14} strokeWidth={2.5} className="mt-px shrink-0" />
          <span>{c.windowClosed}</span>
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words">{error}</span>
        </p>
      )}
    </li>
  )
}

/**
 * The direct-message side of the inbox.
 *
 * Unanswered first, like the comments — but with a clock on each one, because
 * here the chance to answer expires.
 */
export default function Conversations({ accounts = [], channel, ago, notify, onCount }) {
  const { t } = useLanguage()
  const c = t.inbox.dm

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setData(await fetchConversations())
      setError(null)
    } catch (e) {
      setError(e.message)
      setData({ conversations: [], channels: [] })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const conversations = data?.conversations ?? []

  const visible = useMemo(
    () =>
      channel === 'all'
        ? conversations
        : conversations.filter((x) => x.accountId === channel),
    [conversations, channel]
  )

  const waiting = visible.filter((x) => !x.answered).length

  useEffect(() => {
    onCount?.(conversations.filter((x) => !x.answered).length)
  }, [conversations, onCount])

  // Shown where it was written rather than refetched: Instagram takes a moment
  // to list a sent message, and a reload that came back without it would read
  // as the message having failed.
  const onSent = (conversationId, text) =>
    setData((prev) => ({
      ...prev,
      conversations: prev.conversations.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              answered: true,
              messages: [
                ...item.messages,
                { id: `local-${Date.now()}`, text, at: new Date().toISOString(), mine: true },
              ],
            }
          : item
      ),
    }))

  if (!data) {
    return (
      <div className="card flex items-center justify-center gap-3 p-10 text-slate-400">
        <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
        <span className="font-semibold">{c.loading}</span>
      </div>
    )
  }

  const channels = data.channels ?? []
  const broken = channels.filter((x) => x.error)
  // Conversations Instagram listed but whose messages could not be read. An
  // inbox emptied that way must not look like an inbox with no mail in it.
  const unreadable = channels.filter((x) => !x.error && x.found > x.usable)

  return (
    <div>
      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <AlertTriangle size={16} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words">{error}</span>
        </p>
      )}

      {broken.map((ch) => (
        <p
          key={ch.id}
          className="mb-3 flex items-start gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3.5 text-[13px] font-semibold text-amber-900"
        >
          <AlertTriangle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words">
            {fill(c.channelFailed, { username: ch.username })} {ch.error}
          </span>
        </p>
      ))}

      {unreadable.map((ch) => (
        <p
          key={ch.id}
          className="mb-3 flex items-start gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3.5 text-[13px] font-semibold text-amber-900"
        >
          <AlertTriangle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words">
            {fill(c.unreadable, { username: ch.username, found: ch.found, usable: ch.usable })}
          </span>
        </p>
      ))}

      <div className="card mb-4 p-4 sm:p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
          {c.waitingLabel}
        </p>
        <p className="mt-0.5 text-2xl font-extrabold tracking-tight">
          {waiting === 0
            ? c.allDone
            : waiting === 1
              ? c.waitingOne
              : fill(c.waitingCount, { n: waiting })}
        </p>
      </div>

      {visible.length === 0 ? (
        /*
          Stated as a possibility, not a diagnosis. Conversations carry no count
          to check against the way comments carry comments_count, so an empty
          list here genuinely can mean nobody has written — but it can equally
          mean the same restriction that withholds the comments, and someone
          looking at a screen that only says "no conversations" cannot tell.
        */
        <div className="card p-6 text-center sm:p-8">
          <p className="text-sm font-semibold text-slate-400">{c.empty}</p>
          <p className="mx-auto mt-2 max-w-md text-xs font-semibold leading-relaxed text-slate-400">
            {c.emptyWhy}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((conversation) => (
            <Thread
              key={conversation.id}
              conversation={conversation}
              ago={ago}
              onSent={onSent}
              notify={notify}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-xs font-semibold text-slate-400">
        {channels.length > 0 && (
          <>
            {channels
              .map((ch) => fill(c.checkedLine, { username: ch.username, n: ch.found ?? 0 }))
              .join(' · ')}
            <br />
          </>
        )}
        {c.scopeNote}
        {refreshing ? ' …' : ''}
      </p>
    </div>
  )
}
