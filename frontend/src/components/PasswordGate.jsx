import React, { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { api, setPassword } from '../utils/api'

/**
 * Asks for the shared password and proves it before letting the app through.
 *
 * The check is a real request rather than a local comparison — the password is
 * only ever validated by the server, so there is nothing here to work around
 * and nothing to read out of the bundle.
 */
export default function PasswordGate({ onUnlocked }) {
  const { t } = useLanguage()
  const g = t.gate

  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!value.trim()) return

    setBusy(true)
    setError(null)
    try {
      setPassword(value.trim())
      await api('accounts-list')
      onUnlocked()
    } catch (err) {
      setError(err.code === 'unauthorized' ? g.wrong : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 sm:p-8">
        <span
          className="mb-4 grid h-12 w-12 place-items-center rounded-2xl text-white"
          style={{ backgroundImage: 'var(--grad-brand)' }}
        >
          <KeyRound size={22} strokeWidth={2.5} />
        </span>

        <h1 className="text-xl font-extrabold tracking-tight">{t.appName}</h1>
        <p className="mt-1 text-sm text-slate-500">{g.subtitle}</p>

        <label className="label mt-5" htmlFor="app-password">
          {g.label}
        </label>
        <input
          id="app-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field"
        />

        {error && (
          <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !value.trim()} className="btn-primary mt-4 w-full">
          {busy ? <Loader2 size={18} className="animate-spin" strokeWidth={2.5} /> : null}
          {busy ? g.checking : g.submit}
        </button>
      </form>
    </div>
  )
}
