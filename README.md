# SmartContent Hub 🚀

**Yapay Zeka Destekli Multi-Platform Sosyal Medya İçerik Yönetim Sistemi**

SmartContent Hub, Instagram, Facebook, TikTok, Twitter, LinkedIn ve daha fazla platformda otomatik olarak içerik yönetimi, planlama ve yayınlama yapan modern bir web uygulamasıdır.

## 🌟 Özellikler

- ✅ **Multi-Platform Support**: Instagram, Facebook, TikTok, Twitter, LinkedIn, Pinterest
- ✅ **AI Content Generation**: Claude API ile akıllı içerik oluşturma
- ✅ **Intelligent Scheduling**: Akıllı post zamanlama ve dağıtım
- ✅ **Analytics Dashboard**: Tüm platformlar için birleşik analytics
- ✅ **PWA Support**: Çevrimdışı çalışma, mobil kurulum
- ✅ **Multi-Language**: İngilizce (varsayılan) ve Almanca
- ✅ **Real-time Sync**: Tüm platformlar senkronize

## 🏗️ Teknoloji Stack

### Frontend
- **React 18** + Vite
- **Tailwind CSS** - Modern UI
- **Lucide React** - Icons
- **localStorage** - Local state management

### Backend
- **Netlify Functions** - Serverless
- **Anthropic Claude API** - Content generation
- **Instagram Graph API** - Instagram integration
- **Facebook Graph API** - Facebook integration
- **TikTok API** - TikTok integration

### Database
- **Supabase** - PostgreSQL database
- **Real-time subscriptions** - Live updates

## 📁 Proje Yapısı

```
smartcontent-ai/
├── frontend/                    # React uygulaması
│   ├── src/
│   │   ├── components/         # React componentleri
│   │   │   ├── PlatformSelector.jsx
│   │   │   ├── ContentCreator.jsx
│   │   │   ├── ChannelSettings.jsx
│   │   │   └── Analytics.jsx
│   │   ├── pages/              # Sayfalar
│   │   ├── hooks/              # Custom hooks
│   │   └── utils/              # Utility functions
│   └── public/                 # Static dosyalar
│
├── netlify/functions/          # Serverless fonksiyonlar
│   ├── generate-content.js     # Claude API ile content oluştur
│   ├── post-to-instagram.js    # Instagram posting
│   ├── post-to-facebook.js     # Facebook posting
│   ├── post-to-tiktok.js       # TikTok posting
│   ├── post-to-twitter.js      # Twitter posting
│   ├── post-to-linkedin.js     # LinkedIn posting
│   └── unified-scheduler.js    # Genel scheduler
│
├── backend/database/           # Supabase şemaları
│   └── schema.sql
│
└── docs/                       # Dokumentasyon
```

## 🚀 Hızlı Başlangıç

### 1. Repository'yi Klonla
```bash
git clone https://github.com/Zaferyil/SMARTCONTENT-AI
cd SMARTCONTENT-AI
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Environment Variables
```bash
# .env.local dosyası oluştur
VITE_ANTHROPIC_API_KEY=your_key
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_KEY=your_key
```

### 4. Netlify Deploy
```bash
npm install -g netlify-cli
netlify deploy
```

## 🔑 API Keys Gerekli

- **Claude API** - Content generation
- **Instagram Graph API** - Instagram integration
- **Facebook Graph API** - Facebook integration
- **TikTok API** - TikTok integration
- **Supabase** - Database

## 📊 Desteklenen Platformlar

| Platform | Durum | Features |
|----------|-------|----------|
| Instagram | ✅ Aktif | Posts, Stories, Reels |
| Facebook | ✅ Hazır | Posts, Pages |
| TikTok | ✅ Hazır | Videos, Sounds |
| Twitter/X | ✅ Hazır | Tweets, Threads |
| LinkedIn | ✅ Hazır | Posts, Articles |
| Pinterest | ✅ Hazır | Pins, Boards |

## 📝 Lisans

MIT License - Özgürce kullanabilirsiniz

## 🤝 Katkıda Bulunun

Pull requestler welcome! Büyük değişiklikler için önce issue açın.

---

**Geliştirici**: Zafer Yildiz  
**Email**: zafer.yildiz4101@gmail.com  
**Website**: [SmartContent Hub](https://smartcontent-hub.com)
