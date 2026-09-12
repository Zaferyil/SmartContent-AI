import React, { useEffect } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * Floating status message. Sits above the mobile tab bar so it never covers it.
 * `toast.key` changes on every notify() call, which restarts the dismiss timer.
 */
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDismiss, 3200)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  const warn = toast.tone === 'warn'
  const Icon = warn ? AlertTriangle : CheckCircle2

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8"
    >
      <div
        key={toast.key}
        className={`animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-xl ${
          warn
            ? 'border-amber-200 bg-amber-50/95 text-amber-900'
            : 'border-emerald-200 bg-emerald-50/95 text-emerald-900'
        }`}
      >
        <Icon size={19} strokeWidth={2.5} className="shrink-0" />
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
