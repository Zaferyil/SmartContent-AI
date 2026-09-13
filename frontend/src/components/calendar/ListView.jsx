import React from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { getPlatform } from '../../data/platforms'
import { toTimeInput } from '../../utils/calendar'
import StatusChip from './StatusChip'

export default function ListView({ items, onOpen, onDuplicate, onDelete }) {
  const { t, language } = useLanguage()
  const df = new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short' })

  return (
    // The only element on the page allowed to scroll sideways: six columns of
    // real data do not compress to phone width without becoming unreadable.
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-sm">
        <thead>
          <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
            <th className="px-3 pb-1 font-extrabold">{t.schedule.columns.date}</th>
            <th className="px-3 pb-1 font-extrabold">{t.schedule.columns.time}</th>
            <th className="px-3 pb-1 font-extrabold">{t.schedule.columns.content}</th>
            <th className="px-3 pb-1 font-extrabold">{t.schedule.columns.platform}</th>
            <th className="px-3 pb-1 font-extrabold">{t.schedule.columns.status}</th>
            <th className="px-3 pb-1 text-right font-extrabold">{t.schedule.columns.actions}</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const platform = getPlatform(item.platform)
            const when = item.scheduledFor ? new Date(item.scheduledFor) : null

            return (
              <tr key={item.id} className="bg-white/80 shadow-sm">
                <td className="whitespace-nowrap rounded-l-xl px-3 py-2.5 font-bold tabular-nums text-slate-700">
                  {when ? df.format(when) : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-bold tabular-nums text-slate-700">
                  {when ? toTimeInput(when) : '—'}
                </td>
                <td className="max-w-[280px] px-3 py-2.5">
                  <button
                    onClick={() => onOpen(item)}
                    className="line-clamp-1 text-left text-slate-600 hover:text-brand-600 hover:underline"
                  >
                    {item.caption?.replace(/\s+/g, ' ').trim() || '—'}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="text-sm leading-none">{platform?.icon ?? '•'}</span>
                    {platform?.name ?? item.platform}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusChip status={item.status} />
                </td>
                <td className="whitespace-nowrap rounded-r-xl px-3 py-2.5 text-right">
                  <span className="inline-flex gap-1">
                    <button
                      onClick={() => onOpen(item)}
                      aria-label={t.schedule.actions.edit}
                      title={t.schedule.actions.edit}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={15} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => onDuplicate(item)}
                      aria-label={t.schedule.actions.duplicate}
                      title={t.schedule.actions.duplicate}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Copy size={15} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      aria-label={t.schedule.actions.delete}
                      title={t.schedule.actions.delete}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} strokeWidth={2.5} />
                    </button>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
