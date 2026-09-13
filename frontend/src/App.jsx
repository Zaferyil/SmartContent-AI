import React, { useCallback, useEffect, useState } from 'react'
import { Layers, Sparkles, CalendarClock, BarChart3, Settings2 } from 'lucide-react'
import { LanguageProvider, useLanguage } from './i18n/LanguageContext'
import LanguagePicker from './components/LanguagePicker'
import Toast from './components/Toast'
import PlatformSelector from './components/PlatformSelector'
import ContentCreator from './components/ContentCreator'
import ContentCalendar from './components/ContentCalendar'
import Analytics from './components/Analytics'
import ChannelSettings from './components/ChannelSettings'
import PasswordGate from './components/PasswordGate'
import { isUnauthorized, setUnauthorizedHandler } from './utils/api'
import { fetchAccounts } from './utils/schedule'

const TABS = [
  { id: 'platforms', icon: Layers },
  { id: 'create', icon: Sparkles },
  { id: 'schedule', icon: CalendarClock },
  { id: 'analytics', icon: BarChart3 },
  { id: 'settings', icon: Settings2 },
]

const PLATFORMS_KEY = 'smartcontentai_platforms'

function readStoredPlatforms() {
  try {
    const raw = localStorage.getItem(PLATFORMS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // corrupt or unavailable storage — start fresh
  }
  return ['instagram']
}

function Shell() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('platforms')
  const [selectedPlatforms, setSelectedPlatforms] = useState(readStoredPlatforms)
  const [toast, setToast] = useState(null)

  // 'checking' until the first call comes back, so the app never flashes the
  // password screen at someone who is already signed in.
  const [access, setAccess] = useState('checking')
  const [accounts, setAccounts] = useState([])

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await fetchAccounts())
      setAccess('open')
    } catch (error) {
      if (isUnauthorized(error)) return setAccess('locked')
      // Any other failure is a broken backend, not a locked one — let the
      // screens render and report it themselves.
      setAccess('open')
    }
  }, [])

  useEffect(() => {
    // A 401 from anywhere in the app, at any time, returns to the gate.
    setUnauthorizedHandler(() => setAccess('locked'))
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    try {
      localStorage.setItem(PLATFORMS_KEY, JSON.stringify(selectedPlatforms))
    } catch {
      // ignore write failures
    }
  }, [selectedPlatforms])

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() })
  }, [])

  if (access === 'checking') return null
  if (access === 'locked') return <PasswordGate onUnlocked={loadAccounts} />

  const screens = {
    platforms: <PlatformSelector selected={selectedPlatforms} onChange={setSelectedPlatforms} />,
    create: <ContentCreator selected={selectedPlatforms} accounts={accounts} notify={notify} />,
    schedule: (
      <ContentCalendar
        accounts={accounts}
        notify={notify}
        onGoToCreate={() => setActiveTab('create')}
        onGoToSettings={() => setActiveTab('settings')}
      />
    ),
    analytics: <Analytics accounts={accounts} notify={notify} onGoToCreate={() => setActiveTab('create')} />,
    settings: <ChannelSettings notify={notify} onAccountsChanged={loadAccounts} />,
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl shadow-lg shadow-brand-500/30"
              style={{ backgroundImage: 'var(--grad-brand)' }}
              aria-hidden="true"
            >
              ⚡
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight sm:text-xl">
                <span className="gradient-text">{t.appName}</span>
              </h1>
              <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">{t.appTagline}</p>
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden items-center gap-1 lg:flex">
            {TABS.map(({ id, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                    active
                      ? 'text-white shadow-lg shadow-brand-500/30'
                      : 'text-slate-600 hover:bg-white hover:text-brand-600'
                  }`}
                  style={active ? { backgroundImage: 'var(--grad-brand)' } : undefined}
                >
                  <Icon size={17} strokeWidth={2.5} />
                  {t.nav[id]}
                </button>
              )
            })}
          </nav>

          <LanguagePicker onChanged={(message) => notify(message)} />
        </div>
      </header>

      {/* ---------- Content ---------- */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
        <div key={activeTab} className="animate-rise">
          {screens[activeTab]}
        </div>
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/85 pb-safe backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 pt-2">
          {TABS.map(({ id, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors"
              >
                <span
                  className={`grid h-9 w-full max-w-[54px] place-items-center rounded-xl transition-all ${
                    active ? 'text-white shadow-md shadow-brand-500/30' : 'text-slate-400'
                  }`}
                  style={active ? { backgroundImage: 'var(--grad-brand)' } : undefined}
                >
                  <Icon size={19} strokeWidth={2.5} />
                </span>
                <span
                  className={`text-[10px] font-bold leading-none ${
                    active ? 'text-brand-600' : 'text-slate-400'
                  }`}
                >
                  {t.nav[id]}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  )
}
