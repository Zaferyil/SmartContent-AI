import React, { useState } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'

export default function Analytics({ selectedPlatforms }) {
  const [timeRange, setTimeRange] = useState('7days')

  const mockAnalytics = {
    instagram: {
      views: 24500,
      likes: 3200,
      comments: 580,
      followers: 8400,
      engagement: 13.8
    },
    facebook: {
      views: 12300,
      likes: 1800,
      comments: 320,
      followers: 5200,
      engagement: 11.2
    },
    tiktok: {
      views: 45600,
      likes: 8900,
      comments: 1200,
      followers: 12000,
      engagement: 19.5
    },
    twitter: {
      views: 18900,
      likes: 2100,
      comments: 890,
      followers: 4500,
      engagement: 16.8
    },
    linkedin: {
      views: 9800,
      likes: 1200,
      comments: 450,
      followers: 3200,
      engagement: 12.4
    },
    pinterest: {
      views: 32100,
      likes: 4500,
      comments: 200,
      followers: 6800,
      engagement: 14.1
    }
  }

  const platformNames = {
    instagram: '📷 Instagram',
    facebook: '👥 Facebook',
    tiktok: '🎵 TikTok',
    twitter: '𝕏 Twitter',
    linkedin: '💼 LinkedIn',
    pinterest: '📌 Pinterest'
  }

  const calculateTotals = () => {
    const totals = { views: 0, likes: 0, comments: 0, followers: 0, engagement: 0 }
    selectedPlatforms.forEach(platform => {
      const data = mockAnalytics[platform]
      totals.views += data.views
      totals.likes += data.likes
      totals.comments += data.comments
      totals.followers += data.followers
      totals.engagement += data.engagement
    })
    if (selectedPlatforms.length > 0) {
      totals.engagement = (totals.engagement / selectedPlatforms.length).toFixed(1)
    }
    return totals
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      {selectedPlatforms.length === 0 ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
          <p className="text-yellow-800">Lütfen önce <strong>Platformlar</strong> sekmesinden platform seçin.</p>
        </div>
      ) : (
        <>
          {/* Time Range Filter */}
          <div className="bg-white rounded-lg p-4 shadow flex gap-2 flex-wrap">
            {['7days', '30days', '90days', 'all'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded font-medium transition-all ${
                  timeRange === range
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '7days' && '7 Gün'}
                {range === '30days' && '30 Gün'}
                {range === '90days' && '90 Gün'}
                {range === 'all' && 'Tümü'}
              </button>
            ))}
          </div>

          {/* Overall Metrics */}
          <div>
            <h3 className="font-bold text-lg mb-4">📊 Genel İstatistikler</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <div className="text-3xl font-bold text-blue-600">{(totals.views / 1000).toFixed(1)}K</div>
                <div className="text-sm text-gray-600">Toplam Görüntüleme</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <div className="text-3xl font-bold text-red-600">{(totals.likes / 1000).toFixed(1)}K</div>
                <div className="text-sm text-gray-600">Toplam Beğeni</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <div className="text-3xl font-bold text-green-600">{totals.comments}</div>
                <div className="text-sm text-gray-600">Toplam Yorum</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <div className="text-3xl font-bold text-purple-600">{(totals.followers / 1000).toFixed(1)}K</div>
                <div className="text-sm text-gray-600">Toplam Takipçi</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow text-center">
                <div className="text-3xl font-bold text-orange-600">{totals.engagement}%</div>
                <div className="text-sm text-gray-600">Ort. Katılım</div>
              </div>
            </div>
          </div>

          {/* Platform-Specific Analytics */}
          <div>
            <h3 className="font-bold text-lg mb-4">📱 Platform Detayları</h3>
            <div className="space-y-4">
              {selectedPlatforms.map(platformId => {
                const data = mockAnalytics[platformId]
                const name = platformNames[platformId]

                return (
                  <div key={platformId} className="bg-white rounded-lg p-6 shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-lg">{name}</h4>
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp size={20} />
                        <span className="font-bold">+12.3%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{(data.views / 1000).toFixed(1)}K</div>
                        <div className="text-sm text-gray-600">Görüntüleme</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{(data.likes / 1000).toFixed(1)}K</div>
                        <div className="text-sm text-gray-600">Beğeni</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{data.comments}</div>
                        <div className="text-sm text-gray-600">Yorum</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{(data.followers / 1000).toFixed(1)}K</div>
                        <div className="text-sm text-gray-600">Takipçi</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">{data.engagement}%</div>
                        <div className="text-sm text-gray-600">Katılım</div>
                      </div>
                    </div>

                    {/* Performance Bar */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Performans</span>
                        <span className="font-bold text-primary">{Math.round(data.engagement)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(data.engagement * 5, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Performing Content */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h3 className="font-bold text-lg mb-4">🏆 En İyi Performans Gösteren İçerik</h3>
            <div className="space-y-3">
              {[
                { platform: 'TikTok', title: 'Hızlı İpuçları Serisi', engagement: 19.5 },
                { platform: 'Instagram', title: 'Reel Videosu: Başarı Hikayesi', engagement: 18.2 },
                { platform: 'Pinterest', title: 'Tasarım İnfografikleri', engagement: 16.8 }
              ].map((content, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{content.title}</p>
                    <p className="text-sm text-gray-600">{content.platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{content.engagement}%</p>
                    <p className="text-xs text-gray-600">Katılım</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
