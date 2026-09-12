import React, { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import PlatformSelector from './components/PlatformSelector'
import ContentCreator from './components/ContentCreator'
import ChannelSettings from './components/ChannelSettings'
import Analytics from './components/Analytics'
import ScheduleManager from './components/ScheduleManager'

export default function App() {
  const [activeTab, setActiveTab] = useState('platforms')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram'])
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'de')

  const tabs = [
    { id: 'platforms', label: 'Platformlar', icon: '📱' },
    { id: 'content', label: 'İçerik Oluştur', icon: '✨' },
    { id: 'schedule', label: 'Zamanlama', icon: '📅' },
    { id: 'channels', label: 'Kanal Ayarları', icon: '⚙️' },
    { id: 'analytics', label: 'Analytics', icon: '📊' }
  ]

  const translations = {
    de: {
      title: 'SmartContent Hub',
      subtitle: 'AI-gestütztes Multi-Platform Content Management',
      welcome: 'Willkommen zu SmartContent Hub'
    },
    tr: {
      title: 'SmartContent Hub',
      subtitle: 'AI Destekli Multi-Platform İçerik Yönetimi',
      welcome: 'SmartContent Hub\'a Hoş Geldiniz'
    },
    en: {
      title: 'SmartContent Hub',
      subtitle: 'AI-Powered Multi-Platform Content Management',
      welcome: 'Welcome to SmartContent Hub'
    }
  }

  const t = translations[language] || translations.en

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🚀</div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {t.title}
                </h1>
                <p className="text-xs text-gray-500">{t.subtitle}</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>

            {/* Language Selector */}
            <div className="flex gap-2 items-center">
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value)
                  localStorage.setItem('language', e.target.value)
                }}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="de">🇩🇪 Deutsch</option>
                <option value="tr">🇹🇷 Türkçe</option>
                <option value="en">🇬🇧 English</option>
              </select>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`p-3 rounded-lg font-medium transition-all text-center ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div>{tab.icon}</div>
                  <div className="text-xs mt-1">{tab.label}</div>
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="min-h-[calc(100vh-200px)]">
          {/* Platform Selection Tab */}
          {activeTab === 'platforms' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">🌍 Platformlar</h2>
                <p className="text-gray-600">Yönetmek istediğiniz platformları seçin</p>
              </div>
              <PlatformSelector
                selectedPlatforms={selectedPlatforms}
                onSelectionChange={setSelectedPlatforms}
              />
            </div>
          )}

          {/* Content Creator Tab */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">✨ İçerik Oluştur</h2>
                <p className="text-gray-600">AI ile otomatik olarak içerik oluştur</p>
              </div>
              <ContentCreator selectedPlatforms={selectedPlatforms} />
            </div>
          )}

          {/* Schedule Manager Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">📅 Zamanlama</h2>
                <p className="text-gray-600">Postları zamanla ve otomatik yayınla</p>
              </div>
              <ScheduleManager selectedPlatforms={selectedPlatforms} />
            </div>
          )}

          {/* Channel Settings Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Kanal Ayarları</h2>
                <p className="text-gray-600">Her platform için API anahtarlarını yapılandır</p>
              </div>
              <ChannelSettings selectedPlatforms={selectedPlatforms} />
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">📊 Analitiği</h2>
                <p className="text-gray-600">Tüm platformlarınızın performansını izle</p>
              </div>
              <Analytics selectedPlatforms={selectedPlatforms} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">© 2024 SmartContent Hub. AI-powered social media management.</p>
        </div>
      </footer>
    </div>
  )
}
