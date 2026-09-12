import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translations, DEFAULT_LANGUAGE, LANGUAGES } from './translations'

const STORAGE_KEY = 'smartcontentai_language'

const LanguageContext = createContext(null)

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && translations[stored]) return stored
  } catch {
    // localStorage can be unavailable (private mode); fall through to default
  }
  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage)

  const setLanguage = (code) => {
    if (!translations[code]) return
    setLanguageState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // ignore write failures
    }
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languages: LANGUAGES,
      t: translations[language] ?? translations[DEFAULT_LANGUAGE],
    }),
    [language]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
