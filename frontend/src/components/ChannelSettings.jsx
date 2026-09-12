import React, { useState } from 'react'
import { Eye, EyeOff, Save, ShieldCheck, ArrowRight, Check } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { getPlatform } from '../data/platforms'
import ScreenHeader from './ScreenHeader'

const STORAGE_KEY = 'smartcontentai_credentials'

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore unreadable storage
  }
  return {}
}

export default function ChannelSettings({ selected, notify, onGoToPlatforms }) {
  const { t, language, setLanguage, languages } = useLanguage()
  const [creds, setCreds] = useState(readStored)
  const [revealed, setRevealed] = useState({})

  const setField = (platformId, field, value) =>
    setCreds((prev) => ({ ...prev, [platformId]: { ...prev[platformId], [field]: value } }))

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
      notify(t.settings.saved)
    } catch {
      notify(t.settings.saved, 'warn')
    }
  }

  return (
    <div>
      <ScreenHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      {/* ---------- Language ---------- */}
      <section className="card mb-6 p-5 sm:p-6">
        <h3 className="text-base font-extrabold">{t.settings.languageTitle}</h3>
        <p className="mt-1 text-sm text-slate-500">{t.settings.languageHint}</p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {languages.map((lang) => {
            const active = lang.code === language
            return (
              <button
                key={lang.code}
                onClick={() => {
                  if (lang.code === language) return
                  setLanguage(lang.code)
                  notify(translations[lang.code].settings.languageChanged)
                }}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  active
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl leading-none">{lang.flag}</span>
                <span className="flex-1 font-extrabold text-ink">{lang.label}</span>
                {active && (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white">
                    <Check size={14} strokeWidth={4} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ---------- Credentials ---------- */}
      <section>
        <h3 className="text-base font-extrabold">{t.settings.apiTitle}</h3>
        <p className="mb-4 mt-1 text-sm text-slate-500">{t.settings.apiHint}</p>

        {selected.length === 0 ? (
          <button
            onClick={onGoToPlatforms}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/80 px-4 py-3.5 text-left text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100/80"
          >
            {t.settings.noPlatforms}
            <ArrowRight size={17} strokeWidth={2.5} className="shrink-0" />
          </button>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {selected.map((id) => {
                const platform = getPlatform(id)
                if (!platform) return null

                return (
                  <div key={id} className="card overflow-hidden">
                    <div className={`bg-gradient-to-r ${platform.gradient} px-5 py-3.5`}>
                      <h4 className="flex items-center gap-2 font-extrabold text-white">
                        <span className="text-lg leading-none">{platform.icon}</span>
                        {platform.name}
                      </h4>
                    </div>

                    <div className="space-y-4 p-5">
                      {platform.fields.map((field) => {
                        const revealKey = `${id}.${field}`
                        const isSecret = field === 'token' || field === 'apiKey'
                        const shown = revealed[revealKey]
                        return (
                          <div key={field}>
                            <label className="label" htmlFor={revealKey}>
                              {t.settings[field]}
                            </label>
                            <div className="flex gap-2">
                              <input
                                id={revealKey}
                                type={isSecret && !shown ? 'password' : 'text'}
                                value={creds[id]?.[field] ?? ''}
                                onChange={(e) => setField(id, field, e.target.value)}
                                placeholder={t.settings[field]}
                                autoComplete="off"
                                className="field flex-1"
                              />
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealed((prev) => ({ ...prev, [revealKey]: !prev[revealKey] }))
                                  }
                                  aria-label={shown ? t.settings.hide : t.settings.show}
                                  className="grid w-12 shrink-0 place-items-center rounded-2xl border-2 border-slate-200 bg-white/70 text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600"
                                >
                                  {shown ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={save} className="btn-primary mt-5 w-full sm:w-auto sm:px-10">
              <Save size={18} strokeWidth={2.5} />
              {t.settings.save}
            </button>
          </>
        )}
      </section>

      {/* ---------- Security note ---------- */}
      <div className="card mt-6 flex gap-3 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-600">
          <ShieldCheck size={19} strokeWidth={2.5} />
        </span>
        <div>
          <h4 className="text-sm font-extrabold">{t.settings.securityTitle}</h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t.settings.securityBody}</p>
        </div>
      </div>
    </div>
  )
}
