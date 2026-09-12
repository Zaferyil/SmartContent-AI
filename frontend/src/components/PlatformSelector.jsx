import React from 'react'
import { Check } from 'lucide-react'

export default function PlatformSelector({ selectedPlatforms, onSelectionChange }) {
  const platforms = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: '📷',
      description: 'Posts, Stories, Reels',
      color: 'from-pink-400 to-rose-400'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: '👥',
      description: 'Pages, Posts, Videos',
      color: 'from-blue-600 to-blue-400'
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: '🎵',
      description: 'Videos, Sounds, Trends',
      color: 'from-black to-gray-700'
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: '𝕏',
      description: 'Tweets, Threads, Spaces',
      color: 'from-black to-gray-900'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: '💼',
      description: 'Posts, Articles, Events',
      color: 'from-blue-700 to-blue-500'
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      icon: '📌',
      description: 'Pins, Boards, Collections',
      color: 'from-red-600 to-red-400'
    }
  ]

  const handleTogglePlatform = (platformId) => {
    if (selectedPlatforms.includes(platformId)) {
      onSelectionChange(selectedPlatforms.filter(p => p !== platformId))
    } else {
      onSelectionChange([...selectedPlatforms, platformId])
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map(platform => (
          <div
            key={platform.id}
            onClick={() => handleTogglePlatform(platform.id)}
            className={`relative p-6 rounded-lg cursor-pointer transition-all transform ${
              selectedPlatforms.includes(platform.id)
                ? 'ring-2 ring-primary shadow-lg scale-105'
                : 'bg-white hover:shadow-md'
            }`}
            style={{
              background: selectedPlatforms.includes(platform.id)
                ? `linear-gradient(135deg, var(--color-start), var(--color-end))`
                : 'white'
            }}
          >
            {/* Background gradient for selected */}
            {selectedPlatforms.includes(platform.id) && (
              <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${platform.color} opacity-90`} />
            )}

            {/* Content */}
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className="text-4xl">{platform.icon}</div>
                {selectedPlatforms.includes(platform.id) && (
                  <div className="bg-white rounded-full p-1">
                    <Check size={20} className="text-primary" />
                  </div>
                )}
              </div>

              <h3 className={`text-xl font-bold mb-1 ${
                selectedPlatforms.includes(platform.id) ? 'text-white' : 'text-gray-800'
              }`}>
                {platform.name}
              </h3>

              <p className={`text-sm ${
                selectedPlatforms.includes(platform.id) ? 'text-gray-100' : 'text-gray-600'
              }`}>
                {platform.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Platforms Summary */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="font-bold text-lg mb-3">📊 Seçilen Platformlar</h3>
        {selectedPlatforms.length === 0 ? (
          <p className="text-gray-500">Henüz platform seçilmedi</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedPlatforms.map(platformId => {
              const platform = platforms.find(p => p.id === platformId)
              return (
                <div key={platformId} className="bg-primary text-white px-4 py-2 rounded-full font-medium">
                  {platform.icon} {platform.name}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-primary p-6 rounded">
        <h4 className="font-bold text-primary mb-2">💡 İpucu</h4>
        <p className="text-gray-700">
          Birden fazla platform seçebilirsiniz. Sonra aynı içeriği tüm platformlara otomatik olarak yayınlayabilirsiniz.
        </p>
      </div>
    </div>
  )
}
