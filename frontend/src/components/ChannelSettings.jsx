import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { LANGUAGES, translations } from '../i18n/translations'
import { getPlatform } from '../data/platforms'
import { addAccount, fetchAccounts, removeAccount } from '../utils/schedule'
import ScreenHeader from './ScreenHeader'

const fill = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? '').toString())

const TOKEN_HELP = 'https://developers.facebook.com/apps/'

/**
 * The connected accounts.
 *
 * This screen used to save tokens into localStorage, where nothing ever read
 * them — publishing ran entirely off environment variables, so the form looked
 * like it worked and did nothing at all. Accounts now live on the server, a
 * token is checked against Instagram before it is stored, and it is never sent
 * back to the browser.
 */
export default function ChannelSettings({ notify, onAccountsChanged }) {
  const { t, language, setLanguage } = useLanguage()
  const s = t.settings

  const [accounts, setAccounts] = useState(null)
  const [adding, setAdding] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const next = await fetchAccounts()
      setAccounts(next)
      // The other screens hold their own copy; connecting a channel has to show
      // up in the calendar's picker without a reload.
      onAccountsChanged?.()
    } catch (e) {
      notify(e.message, 'warn')
      setAccounts([])
    }
  }, [notify, onAccountsChanged])

  useEffect(() => {
    load()
  }, [load])

  const connect = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const account = await addAccount(token.trim())
      await load()
      setToken('')
      setAdding(false)
      notify(fill(s.connected, { username: account.username ?? '' }))
    } catch (err) {
      // Kept in the form rather than only in a toast: this is the one place the
      // user can act on it, by pasting a different token.
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (account) => {
    try {
      setAccounts(await removeAccount(account.id))
      onAccountsChanged?.()
      notify(fill(s.removed, { username: account.username ?? '' }))
    } catch (e) {
      notify(e.message, 'warn')
    }
  }

  const df = new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric' })

  if (accounts === null) {
    return (
      <div>
        <ScreenHeader title={s.title} subtitle={s.subtitle} />
        <div className="card flex items-center justify-center gap-3 p-10 text-slate-400">
          <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
          <span className="font-semibold">{s.loading}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ScreenHeader title={s.title} subtitle={s.subtitle} />

      {/* ---------- Connected accounts ---------- */}
      <h3 className="mb-3 text-sm font-extrabold text-slate-700">{s.connectedTitle}</h3>

      {accounts.length === 0 ? (
        <p className="card mb-4 p-6 text-center text-sm font-semibold text-slate-400">
          {s.noneConnected}
        </p>
      ) : (
        <ul className="mb-4 space-y-3">
          {accounts.map((account) => {
            const platform = getPlatform(account.platform)
            return (
              <li key={account.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-extrabold">
                      <span className="text-lg leading-none">{platform?.icon ?? '•'}</span>
                      @{account.username ?? account.externalId}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                      {platform?.name ?? account.platform}
                      {account.accountType ? ` · ${account.accountType}` : ''} · {account.tokenHint}
                    </p>
                  </div>

                  <button
                    onClick={() => disconnect(account)}
                    aria-label={s.disconnect}
                    title={s.disconnect}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Token health — the thing that otherwise stops posts silently */}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {account.lastError ? (
                    <p className="flex items-start gap-1.5 text-xs font-bold text-rose-700">
                      <AlertTriangle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                      <span className="break-words">{account.lastError}</span>
                    </p>
                  ) : account.expiringSoon ? (
                    <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                      <AlertTriangle size={13} strokeWidth={2.5} />
                      {fill(s.expiresIn, { days: account.daysLeft })}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      {account.daysLeft === null
                        ? s.tokenOk
                        : fill(s.tokenValidFor, { days: account.daysLeft })}
                    </p>
                  )}

                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {account.lastRefreshedAt
                      ? fill(s.lastRefreshed, { date: df.format(new Date(account.lastRefreshedAt)) })
                      : s.autoRefresh}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* ---------- Add ---------- */}
      {adding ? (
        <form onSubmit={connect} className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-700">{s.addTitle}</h3>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
              aria-label={t.common.close}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <p className="mb-4 text-[13px] text-slate-500">{s.addHint}</p>

          <label className="label" htmlFor="token">
            {s.token}
          </label>
          <textarea
            id="token"
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="IGQ..."
            className="field resize-y font-mono text-[13px]"
          />

          {error && (
            <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
              <span className="break-words">{error}</span>
            </p>
          )}

          <button type="submit" disabled={busy || !token.trim()} className="btn-primary mt-4 w-full">
            {busy ? (
              <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
            ) : (
              <ShieldCheck size={18} strokeWidth={2.5} />
            )}
            {busy ? s.checking : s.checkAndConnect}
          </button>

          <a
            href={TOKEN_HELP}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-brand-600 hover:underline"
          >
            {s.whereToken}
            <ExternalLink size={12} strokeWidth={2.5} />
          </a>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-primary w-full sm:w-auto">
          <Plus size={18} strokeWidth={3} />
          {s.addChannel}
        </button>
      )}

      {/* ---------- How it stays connected ---------- */}
      <div className="card mt-6 p-5 sm:p-6">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-slate-700">
          <RefreshCw size={15} strokeWidth={2.5} className="text-slate-400" />
          {s.stayConnectedTitle}
        </h3>
        <p className="text-[13px] leading-relaxed text-slate-500">{s.stayConnectedBody}</p>
      </div>

      <div className="card mt-4 p-5 sm:p-6">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-slate-700">
          <ShieldCheck size={15} strokeWidth={2.5} className="text-slate-400" />
          {s.securityTitle}
        </h3>
        <p className="text-[13px] leading-relaxed text-slate-500">{s.securityBody}</p>
      </div>

      {/* ---------- Language ---------- */}
      <section className="card mt-4 p-5 sm:p-6">
        <h3 className="text-sm font-extrabold text-slate-700">{s.languageTitle}</h3>
        <p className="mt-1 text-[13px] text-slate-500">{s.languageHint}</p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {LANGUAGES.map((lang) => {
            const active = lang.code === language
            return (
              <button
                key={lang.code}
                onClick={() => {
                  if (active) return
                  setLanguage(lang.code)
                  // Announced in the language being switched to, not the old one.
                  notify(translations[lang.code].settings.languageChanged)
                }}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  active
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300'
                }`}
              >
                <span className="text-xl leading-none">{lang.flag}</span>
                <span className={`font-bold ${active ? 'text-brand-700' : 'text-slate-600'}`}>
                  {lang.label}
                </span>
                {active && <CheckCircle2 size={17} strokeWidth={2.5} className="ml-auto text-brand-600" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
