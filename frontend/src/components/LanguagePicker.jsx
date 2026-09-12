import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'

export default function LanguagePicker({ onChanged }) {
  const { language, setLanguage, languages } = useLanguage()
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const current = languages.find((l) => l.code === language) ?? languages[0]

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const pick = (code) => {
    setOpen(false)
    if (code === language) return
    setLanguage(code)
    // Announce in the language just chosen, not the one being left behind.
    onChanged?.(translations[code].settings.languageChanged)
  }

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white/80 px-3 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-brand-400"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={15} strokeWidth={3} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl"
        >
          {languages.map((lang) => {
            const active = lang.code === language
            return (
              <li key={lang.code}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(lang.code)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg leading-none">{lang.flag}</span>
                  <span className="flex-1 text-left">{lang.label}</span>
                  {active && <Check size={16} strokeWidth={3} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
