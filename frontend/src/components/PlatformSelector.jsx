import React from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { PLATFORMS } from '../data/platforms'
import ScreenHeader from './ScreenHeader'

export default function PlatformSelector({ selected, onChange }) {
  const { t } = useLanguage()

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id])

  const allSelected = selected.length === PLATFORMS.length

  return (
    <div>
      <ScreenHeader
        title={t.platforms.title}
        subtitle={t.platforms.subtitle}
        action={
          <button
            onClick={() => onChange(allSelected ? [] : PLATFORMS.map((p) => p.id))}
            className="btn-ghost !px-4 !py-2.5 !text-sm"
          >
            {allSelected ? t.platforms.clearAll : t.platforms.selectAll}
          </button>
        }
      />

      {/* Selection counter */}
      <div className="mb-5 flex items-center gap-2">
        <span
          className="chip text-white shadow-md shadow-brand-500/25"
          style={{ backgroundImage: 'var(--grad-brand)' }}
        >
          {selected.length}
        </span>
        <span className="text-sm font-semibold text-slate-600">
          {selected.length === 0 ? t.platforms.noneSelected : t.platforms.selected}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const active = selected.includes(platform.id)
          return (
            <button
              key={platform.id}
              onClick={() => toggle(platform.id)}
              aria-pressed={active}
              className={`group relative overflow-hidden rounded-3xl border-2 p-4 text-left transition-all duration-300 sm:p-5 ${
                active
                  ? 'border-transparent shadow-xl shadow-brand-500/20'
                  : 'border-white/70 bg-white/70 shadow-glow backdrop-blur-xl hover:-translate-y-1 hover:shadow-xl'
              }`}
            >
              {/* Brand wash, full bleed when selected, a soft corner glow when not */}
              <span
                aria-hidden="true"
                className={`absolute inset-0 bg-gradient-to-br ${platform.gradient} transition-opacity duration-300 ${
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-10'
                }`}
              />

              <span className="relative flex flex-col gap-2.5">
                <span className="flex items-start justify-between">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl transition-colors ${
                      active ? 'bg-white/25 backdrop-blur-sm' : 'bg-slate-100'
                    }`}
                  >
                    {platform.icon}
                  </span>
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full transition-all ${
                      active ? 'scale-100 bg-white text-slate-900' : 'scale-0 bg-transparent'
                    }`}
                  >
                    <Check size={15} strokeWidth={4} />
                  </span>
                </span>

                <span>
                  <span
                    className={`block text-base font-extrabold sm:text-lg ${
                      active ? 'text-white' : 'text-ink'
                    }`}
                  >
                    {platform.name}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] font-semibold sm:text-xs ${
                      active ? 'text-white/85' : 'text-slate-500'
                    }`}
                  >
                    {platform.formats}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="card mt-6 flex gap-3 p-5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
          style={{ backgroundImage: 'var(--grad-brand)' }}
        >
          <Sparkles size={19} strokeWidth={2.5} />
        </span>
        <div>
          <h3 className="text-sm font-extrabold">{t.platforms.tipTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t.platforms.tipBody}</p>
        </div>
      </div>
    </div>
  )
}
