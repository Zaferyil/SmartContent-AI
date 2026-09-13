import React from 'react'
import { AlertCircle, CheckCircle2, Clock, FileEdit, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

/**
 * Status always pairs an icon with its word — the colour is reinforcement, not
 * the message, so the state still reads without it.
 */
const LOOKS = {
  draft: { icon: FileEdit, className: 'bg-slate-100 text-slate-600' },
  scheduled: { icon: Clock, className: 'bg-brand-50 text-brand-700' },
  publishing: { icon: Loader2, className: 'bg-amber-50 text-amber-700', spin: true },
  published: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700' },
  failed: { icon: AlertCircle, className: 'bg-rose-50 text-rose-700' },
}

export default function StatusChip({ status, size = 12 }) {
  const { t } = useLanguage()
  const look = LOOKS[status] ?? LOOKS.draft
  const Icon = look.icon

  return (
    <span className={`chip ${look.className}`}>
      <Icon size={size} strokeWidth={2.5} className={look.spin ? 'animate-spin' : undefined} />
      {t.schedule.status[status] ?? status}
    </span>
  )
}

export { LOOKS as STATUS_LOOKS }
