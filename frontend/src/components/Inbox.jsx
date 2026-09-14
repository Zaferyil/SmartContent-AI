import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CornerDownRight,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchComments, replyToComment } from '../utils/comments'
import Conversations from './inbox/Conversations'
import ScreenHeader from './ScreenHeader'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

/** "vor 2 Std", in whichever language the app is in. */
function useAgo(language) {
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
    const steps = [
      ['minute', 60_000],
      ['hour', 3_600_000],
      ['day', 86_400_000],
    ]
    return (timestamp) => {
      const ms = Date.parse(timestamp)
      if (Number.isNaN(ms)) return ''
      const diff = Date.now() - ms
      let unit = 'day'
      let size = 86_400_000
      for (const [candidate, span] of steps) {
        if (diff < span * 60 || candidate === 'day') {
          unit = candidate
          size = span
          break
        }
      }
      return rtf.format(-Math.max(1, Math.round(diff / size)), unit)
    }
  }, [language])
}

/**
 * One comment, its replies, and a box to answer it.
 *
 * Sending is optimistic in the display but not in the claim: the reply appears
 * straight away because that is what the user just wrote, and a failure puts it
 * back in the box with the reason rather than leaving a reply on screen that
 * Instagram never took.
 */
function Thread({ comment, ago, onReplied, notify, t }) {
  const c = t.inbox
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const send = async () => {
    const message = draft.trim()
    if (!message) return

    setSending(true)
    setError(null)
    try {
      await replyToComment({ commentId: comment.id, message, accountId: comment.accountId })
      setDraft('')
      onReplied(comment.id, message)
      notify(c.sent)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        {comment.media.thumbnail && (
          <img
            src={comment.media.thumbnail}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-extrabold">@{comment.username ?? '—'}</span>
            <span className="text-xs font-semibold text-slate-400">{ago(comment.timestamp)}</span>
            {comment.answered ? (
              <span className="chip bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={12} strokeWidth={2.5} />
                {c.answered}
              </span>
            ) : (
              <span className="chip bg-amber-50 text-amber-700">
                <MessageCircle size={12} strokeWidth={2.5} />
                {c.waiting}
              </span>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">
            {comment.text}
          </p>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-400">
            <span>@{comment.accountUsername}</span>
            {comment.media.permalink && (
              <a
                href={comment.media.permalink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-brand-600 hover:underline"
              >
                {c.openPost}
                <ExternalLink size={11} strokeWidth={2.5} />
              </a>
            )}
          </p>
        </div>
      </div>

      {comment.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
          {comment.replies.map((reply) => (
            <li key={reply.id} className="text-[13px]">
              <span className="flex items-start gap-1.5">
                <CornerDownRight size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-slate-300" />
                <span className="min-w-0">
                  <span className={`font-extrabold ${reply.mine ? 'text-brand-700' : 'text-slate-600'}`}>
                    @{reply.username ?? '—'}
                  </span>{' '}
                  <span className="break-words text-slate-600">{reply.text}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
          placeholder={fill(c.replyPlaceholder, { username: comment.username ?? '' })}
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
 * Comments on recent posts, unanswered first.
 *
 * A question under a post that nobody answers is the most expensive thing on
 * this screen — everyone scrolling past can see it went ignored — so the order
 * is the order the work should be done in, not the order Instagram returns.
 */
export default function Inbox({ accounts = [], notify }) {
  const { t, language } = useLanguage()
  const c = t.inbox
  const ago = useAgo(language)

  const [data, setData] = useState(null)
  const [channel, setChannel] = useState('all')
  // Comments and direct messages are the same job — answering people — so they
  // share a tab rather than claiming a seventh one the phone has no room for.
  const [section, setSection] = useState('comments')
  const [dmWaiting, setDmWaiting] = useState(0)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setData(await fetchComments())
      setError(null)
    } catch (e) {
      setError(e.message)
      setData({ comments: [], channels: [] })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const comments = data?.comments ?? []
  const visible = useMemo(
    () => (channel === 'all' ? comments : comments.filter((x) => x.accountId === channel)),
    [comments, channel]
  )
  const waiting = visible.filter((x) => !x.answered).length

  // A sent reply is shown where it was written, without refetching: Instagram
  // takes a moment to list a new reply, and a refresh that came back without it
  // would read as the reply having failed.
  const onReplied = (commentId, message) =>
    setData((prev) => ({
      ...prev,
      comments: prev.comments.map((item) =>
        item.id === commentId
          ? {
              ...item,
              answered: true,
              replies: [
                ...item.replies,
                {
                  id: `local-${Date.now()}`,
                  text: message,
                  timestamp: new Date().toISOString(),
                  username: item.accountUsername,
                  mine: true,
                },
              ],
            }
          : item
      ),
    }))

  const header = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <ScreenHeader title={c.title} subtitle={c.subtitle} />
      <button onClick={load} disabled={refreshing} className="btn-ghost !px-4 !py-2.5 !text-[14px]">
        <RefreshCw size={16} strokeWidth={2.5} className={refreshing ? 'animate-spin' : ''} />
        {c.refresh}
      </button>
    </div>
  )

  const channels = data?.channels ?? []
  // Three different "nothing here" states, kept apart. The account could not be
  // read at all; its posts were read but every one of them refused its comments
  // — which is what a missing comments permission looks like; or there really
  // is nothing to answer.
  const brokenChannels = channels.filter((x) => x.error)
  const blockedChannels = channels.filter((x) => !x.error && x.allFailed)
  const emptyChannels = channels.filter((x) => !x.error && x.posts === 0)
  const withholdingChannels = channels.filter((x) => !x.error && !x.allFailed && x.withheld)

  const segments = [
    { id: 'comments', label: c.tabComments, open: comments.filter((x) => !x.answered).length },
    { id: 'messages', label: c.tabMessages, open: dmWaiting },
  ]

  return (
    <div>
      {header}

      <div className="mb-4 flex flex-wrap gap-2">
        {segments.map((segment) => {
          const active = section === segment.id
          return (
            <button
              key={segment.id}
              onClick={() => setSection(segment.id)}
              aria-pressed={active}
              className={`chip border-2 transition-all ${
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300'
              }`}
            >
              {segment.label}
              {segment.open > 0 && (
                <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">
                  {segment.open}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {accounts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: 'all', username: c.allChannels }, ...accounts].map((account) => {
            const active = channel === account.id
            return (
              <button
                key={account.id}
                onClick={() => setChannel(account.id)}
                aria-pressed={active}
                className={`chip border-2 transition-all ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300'
                }`}
              >
                {account.id === 'all' ? account.username : `@${account.username}`}
              </button>
            )
          })}
        </div>
      )}

      {section === 'messages' && (
        <Conversations
          accounts={accounts}
          channel={channel}
          ago={ago}
          notify={notify}
          onCount={setDmWaiting}
        />
      )}

      {section === 'comments' && !data && (
        <div className="card flex items-center justify-center gap-3 p-10 text-slate-400">
          <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
          <span className="font-semibold">{c.loading}</span>
        </div>
      )}

      {section === 'comments' && data && (
        <>

      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <AlertTriangle size={16} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words">{error}</span>
        </p>
      )}

      {/* One channel failing is not the same as there being nothing to answer,
          and an empty screen cannot tell the two apart on its own. */}
      {brokenChannels.map((ch) => (
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
        <p className="card p-8 text-center text-sm font-semibold text-slate-400">{c.empty}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((comment) => (
            <Thread
              key={comment.id}
              comment={comment}
              ago={ago}
              onReplied={onReplied}
              notify={notify}
              t={t}
            />
          ))}
        </ul>
      )}

      {/* What was actually looked at. Without it, "no comments" and "nothing
          could be read" are the same screen. */}
      <p className="mt-4 text-center text-xs font-semibold text-slate-400">
        {channels.length > 0 && (
          <>
            {channels
              .map((ch) =>
                fill(c.checkedLine, {
                  username: ch.username,
                  n: ch.checked ?? 0,
                  reported: ch.reportedComments ?? 0,
                })
              )
              .join(' · ')}
            <br />
          </>
        )}
        {c.scopeNote}
      </p>
        </>
      )}
    </div>
  )
}
