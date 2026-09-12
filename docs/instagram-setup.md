# Instagram bağlantısı

## 1. Değerleri hazırla

Meta uygulama panelinden aldığın **access token** ve Instagram **user id**.

User id'yi kendi token'ınla oku:

```bash
curl "https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=TOKEN"
```

## 2. Yerel geliştirme

```bash
cp .env.example .env
```

`.env` dosyasını doldur. Bu dosya `.gitignore`'da — asla commit etme.

```bash
npm install
npm install --prefix frontend
npx netlify dev
```

> Netlify CLI, projenin devDependency'si olarak geliyor — ayrıca kurmana gerek
> yok. `npm install -g netlify-cli` macOS'ta `EACCES` hatası verir çünkü
> `/usr/local` kullanıcıya yazılabilir değil; `sudo` ise ileride başka izin
> sorunları doğurur. Yereli kullan.

Bağlantıyı doğrula:

```bash
curl http://localhost:8888/.netlify/functions/instagram-verify
```

Beklenen çıktı:

```json
{ "ok": true, "username": "...", "userIdMatches": true, "quotaUsed": 0, "quotaTotal": 100 }
```

`userIdMatches: false` görürsen `IG_USER_ID` token'ın ait olduğu hesapla eşleşmiyor demektir.

## 3. Test gönderisi

Görsel **herkese açık bir HTTPS adresinde** olmalı — Instagram sunucusu onu kendisi indiriyor. `localhost`, giriş isteyen ya da süresi dolan adresler çalışmaz.

```bash
curl -X POST http://localhost:8888/.netlify/functions/instagram-publish \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://picsum.photos/1080","caption":"İlk otomatik gönderi 🚀"}'
```

## 4. Netlify'da yayın

Token'ı koda veya depoya koyma. Netlify panelinden gir:

**Site settings → Environment variables** → `IG_ACCESS_TOKEN`, `IG_USER_ID`

Aynısını CLI ile:

```bash
netlify env:set IG_ACCESS_TOKEN "..."
netlify env:set IG_USER_ID "..."
```

Yayına alırken `ALLOWED_ORIGIN` değişkenini de site adresine ayarla; aksi halde fonksiyonları herhangi bir site çağırabilir.

## Sık karşılaşılan hatalar

| Meta kodu | Anlamı | Çözüm |
|---|---|---|
| `190` | Token geçersiz veya süresi dolmuş | Panelden yeni token üret |
| `100` | Parametre hatalı, genelde erişilemeyen medya URL'i | URL'i tarayıcıda gizli sekmede aç, açılıyor mu bak |
| `4` / `17` | Hız limiti | 24 saatte 100 gönderi sınırı |
| `200` | İzin eksik | `instagram_business_content_publish` verilmemiş |

## Bilinen sınırlar

- **Token 60 gün geçerli.** Dolmadan yenilenmeli; otomatik yenileme henüz yazılmadı.
- **Video ve reels** senkron fonksiyonda yayınlanamaz. Netlify'ın ücretsiz planında fonksiyon 10 saniyede kesilir, video işleme daha uzun sürer. Bunun için `-background` sonekli bir fonksiyon gerekiyor — henüz eklenmedi, şimdilik sadece görsel gönderisi çalışıyor.
- **Başka kullanıcılar** uygulamayı kullanacaksa Meta App Review şart (2-4 hafta).
