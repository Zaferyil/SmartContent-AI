import React, { useState } from 'react'
import { Key, Save, Eye, EyeOff } from 'lucide-react'

export default function ChannelSettings({ selectedPlatforms }) {
  const [settings, setSettings] = useState({
    instagram: { token: '', businessAccountId: '' },
    facebook: { token: '', pageId: '' },
    tiktok: { token: '', businessAccountId: '' },
    twitter: { token: '', apiKey: '' },
    linkedin: { token: '', organizationId: '' },
    pinterest: { token: '', businessAccountId: '' }
  })

  const [showPassword, setShowPassword] = useState({})
  const [saved, setSaved] = useState(false)

  const platformConfig = {
    instagram: { label: 'Instagram', icon: '📷', fields: ['token', 'businessAccountId'] },
    facebook: { label: 'Facebook', icon: '👥', fields: ['token', 'pageId'] },
    tiktok: { label: 'TikTok', icon: '🎵', fields: ['token', 'businessAccountId'] },
    twitter: { label: 'Twitter/X', icon: '𝕏', fields: ['token', 'apiKey'] },
    linkedin: { label: 'LinkedIn', icon: '💼', fields: ['token', 'organizationId'] },
    pinterest: { label: 'Pinterest', icon: '📌', fields: ['token', 'businessAccountId'] }
  }

  const handleChange = (platform, field, value) => {
    setSettings(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }))
  }

  const handleSave = () => {
    localStorage.setItem('channelSettings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const togglePasswordVisibility = (key) => {
    setShowPassword(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded flex items-center gap-2">
          <span>✅</span>
          <span>Ayarlar kaydedildi!</span>
        </div>
      )}

      {/* Settings for selected platforms */}
      {selectedPlatforms.length === 0 ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
          <p className="text-yellow-800">Lütfen önce <strong>Platformlar</strong> sekmesinden platform seçin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedPlatforms.map(platformId => {
            const platform = platformConfig[platformId]
            if (!platform) return null

            return (
              <div key={platformId} className="bg-white rounded-lg p-6 shadow">
                <h3 className="font-bold text-lg mb-4">{platform.icon} {platform.label} API</h3>

                <div className="space-y-4">
                  {platform.fields.map(field => (
                    <div key={field}>
                      <label className="block font-medium text-sm mb-2 capitalize">
                        {field === 'token' ? '🔑 API Token' : field.replace(/([A-Z])/g, ' $1')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword[`${platformId}-${field}`] ? 'text' : 'password'}
                          value={settings[platformId][field]}
                          onChange={(e) => handleChange(platformId, field, e.target.value)}
                          placeholder={`${platform.label} ${field} girin`}
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => togglePasswordVisibility(`${platformId}-${field}`)}
                          className="p-3 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          {showPassword[`${platformId}-${field}`] ? (
                            <EyeOff size={20} className="text-gray-600" />
                          ) : (
                            <Eye size={20} className="text-gray-600" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {field === 'token' && `${platform.label} Developer Console'dan alın`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Save Button */}
      {selectedPlatforms.length > 0 && (
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="flex-1 bg-primary text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Ayarları Kaydet
          </button>
          <button
            onClick={() => {
              const defaultSettings = {}
              selectedPlatforms.forEach(p => {
                defaultSettings[p] = { token: '', businessAccountId: '', pageId: '', apiKey: '', organizationId: '' }
              })
              setSettings(prev => ({ ...prev, ...defaultSettings }))
            }}
            className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 transition-all"
          >
            Temizle
          </button>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
        <div className="flex gap-2">
          <Key size={20} className="text-yellow-600 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <strong>Güvenlik:</strong> API anahtarlarınız sadece bu cihazda localStorage'da saklanır. Asla paylaşmayın.
          </div>
        </div>
      </div>
    </div>
  )
}
