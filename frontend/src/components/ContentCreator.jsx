import React, { useState } from 'react'
import { Zap, Copy, RefreshCw } from 'lucide-react'

export default function ContentCreator({ selectedPlatforms }) {
  const [contentType, setContentType] = useState('caption')
  const [topic, setTopic] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const contentTypes = [
    { id: 'caption', label: 'Başlık', icon: '📝' },
    { id: 'hashtags', label: 'Hashtag\'lar', icon: '#️⃣' },
    { id: 'description', label: 'Açıklama', icon: '📄' },
    { id: 'hook', label: 'Hook', icon: '🎣' }
  ]

  const handleGenerateContent = async () => {
    if (!topic.trim()) {
      alert('Lütfen konu girin')
      return
    }

    setLoading(true)
    try {
      // Mock API call - replace with actual Claude API
      const mockResponses = {
        caption: `🚀 ${topic} ile başarısı yakalayın!\n\nSmartContent Hub ile sosyal medya yönetimi hiç bu kadar kolay olmamıştı. Otomatik içerik oluşturma, akıllı zamanlama ve çoklu platform desteği.\n\n#${topic.replace(/ /g, '')} #SmartContent #SocialMedia`,
        hashtags: `#${topic.replace(/ /g, '')} #SmartContent #AI #SocialMedia #Marketing #ContentCreator #Automation #Digital`,
        description: `${topic} hakkında detaylı bilgi içeren profesyonel açıklama metni. Bu içerik SmartContent Hub'ın AI yapılandırıcısı tarafından otomatik olarak oluşturulmuştur.`,
        hook: `Herkez bilmek ister: ${topic} hakkında gerçek şu...\n\n⬇️ Okumaya devam et`
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      setGeneratedContent(mockResponses[contentType])
    } catch (error) {
      console.error('İçerik oluşturma hatası:', error)
      alert('İçerik oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyContent = () => {
    navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerateContent = () => {
    handleGenerateContent()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 bg-white rounded-lg p-6 shadow">
          <div className="space-y-4">
            {/* Content Type Selection */}
            <div>
              <label className="block font-bold mb-2">📝 İçerik Türü</label>
              <div className="grid grid-cols-2 gap-2">
                {contentTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setContentType(type.id)}
                    className={`p-2 rounded text-sm font-medium transition-all ${
                      contentType === type.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Input */}
            <div>
              <label className="block font-bold mb-2">🎯 Konu / Anahtar Kelime</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Örn: Yapay Zeka, Sosyal Medya Marketing, İşletme Büyütme..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows="4"
              />
            </div>

            {/* Platform Info */}
            <div>
              <label className="block font-bold mb-2">📱 Hedef Platformlar</label>
              <div className="flex flex-wrap gap-2">
                {selectedPlatforms.length === 0 ? (
                  <p className="text-sm text-gray-500">Platform seçilmedi</p>
                ) : (
                  selectedPlatforms.map(platform => (
                    <div key={platform} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateContent}
              disabled={loading || !topic.trim()}
              className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all ${
                loading || !topic.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-primary to-secondary hover:shadow-lg'
              }`}
            >
              <Zap size={20} />
              {loading ? 'Oluşturuluyor...' : 'İçerik Oluştur'}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">✨ Oluşturulan İçerik</h3>
              {generatedContent && (
                <div className="flex gap-2">
                  <button
                    onClick={handleRegenerateContent}
                    disabled={loading}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                    title="Yeniden oluştur"
                  >
                    <RefreshCw size={20} className={loading ? 'text-gray-400' : 'text-gray-700'} />
                  </button>
                  <button
                    onClick={handleCopyContent}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all text-primary"
                    title="Panoya kopyala"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              )}
            </div>

            {generatedContent ? (
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-800 whitespace-pre-wrap">{generatedContent}</p>
                </div>

                {copied && (
                  <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-2 rounded flex items-center gap-2">
                    <span>✅</span>
                    <span>Panoya kopyalandı!</span>
                  </div>
                )}

                {/* Save Button */}
                <div className="flex gap-2">
                  <button className="flex-1 bg-primary text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-all">
                    💾 Taslağa Kaydet
                  </button>
                  <button className="flex-1 bg-secondary text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition-all">
                    📤 Yayınla
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-4">🤖</div>
                <p className="text-gray-500">
                  İçerik oluşturmaya başlamak için konu girin ve "İçerik Oluştur" düğmesini tıklayın.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Examples */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="font-bold text-lg mb-4">📚 Örnek Şablonlar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: 'Ürün Tanıtımı', emoji: '🛍️' },
            { title: 'Motivasyon Metni', emoji: '💪' },
            { title: 'Eğitim İçeriği', emoji: '📚' },
            { title: 'İşbirliği Teklifı', emoji: '🤝' }
          ].map((template, idx) => (
            <button
              key={idx}
              onClick={() => setTopic(template.title)}
              className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow transition-all text-left"
            >
              <span className="text-2xl mr-2">{template.emoji}</span>
              <span className="font-medium">{template.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
