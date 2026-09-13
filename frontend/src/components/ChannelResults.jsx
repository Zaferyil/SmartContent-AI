import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

/**
 * What happened on each channel, after posting to more than one.
 *
 * Shown instead of a single toast because the interesting case is the mixed
 * one: the user needs to see which channel still needs attention, and which one
 * must not be retried because the post is already live there.
 */
export default function ChannelResults({ results, title }) {
  if (!results?.length) return null

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white/70 p-3.5">
      {title && <p className="mb-2 text-xs font-extrabold text-slate-500">{title}</p>}

      <ul className="space-y-1.5">
        {results.map(({ channel, ok, error }) => (
          <li key={channel.id} className="flex items-start gap-2 text-[13px]">
            {ok ? (
              <CheckCircle2
                size={15}
                strokeWidth={2.5}
                className="mt-px shrink-0 text-emerald-600"
              />
            ) : (
              <AlertTriangle size={15} strokeWidth={2.5} className="mt-px shrink-0 text-rose-600" />
            )}

            <span className="min-w-0">
              <span className={`font-extrabold ${ok ? 'text-emerald-800' : 'text-rose-800'}`}>
                @{channel.username ?? channel.externalId}
              </span>
              {!ok && error && (
                <span className="break-words font-semibold text-rose-900/70"> — {error}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
