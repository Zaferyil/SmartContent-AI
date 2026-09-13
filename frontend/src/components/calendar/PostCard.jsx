import React from 'react'
import { getPlatform } from '../../data/platforms'
import { toTimeInput } from '../../utils/calendar'
import { STATUS_LOOKS } from './StatusChip'

/**
 * One post inside a calendar cell.
 *
 * Deliberately small: a week column holds several of these and the point of the
 * grid is the shape of the week, not the wording of any one post. The status is
 * a left edge rather than a chip so it survives at this size.
 */
export default function PostCard({ item, onOpen, draggable = false, onDragStart }) {
  const platform = getPlatform(item.platform)
  const look = STATUS_LOOKS[item.status] ?? STATUS_LOOKS.draft
  const preview = item.caption?.replace(/\s+/g, ' ').trim()

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, item) : undefined}
      className={`group w-full rounded-xl border border-slate-200/80 bg-white/90 p-2 text-left shadow-sm transition-all hover:border-brand-300 hover:shadow-md ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`h-3.5 w-1 shrink-0 rounded-full ${look.className.split(' ')[0]}`}
        />
        <span className="text-[11px] font-extrabold tabular-nums text-slate-700">
          {item.scheduledFor ? toTimeInput(item.scheduledFor) : '—'}
        </span>
        {platform && <span className="text-[11px] leading-none">{platform.icon}</span>}
      </span>

      {/*
        Two lines, held down two ways. line-clamp gives the ellipsis, but it
        needs `display: -webkit-box` to survive — and it does not always: adding
        `block` here once silently cancelled it, and it is not honoured on every
        browser this runs on. The max-height is the floor underneath it, so the
        worst case is a card cut without an ellipsis rather than a card as tall
        as a 300-word caption, which is what pushed the week off the page.

        2.75em is two lines at leading-snug (1.375).
      */}
      {preview ? (
        <span className="mt-1 line-clamp-2 max-h-[2.75em] overflow-hidden text-[11px] leading-snug text-slate-500">
          {preview}
        </span>
      ) : (
        <span className="mt-1 block text-[11px] italic leading-snug text-slate-300">—</span>
      )}
    </button>
  )
}
