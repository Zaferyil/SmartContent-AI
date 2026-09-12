# Cloudflare R2 kurulumu

Instagram görseli **kendi sunucusundan indiriyor**, yani görselin herkese açık bir adreste durması gerekiyor. R2 bu işi yapıyor: 10 GB depolama ücretsiz ve **çıkış trafiği ücretsiz** — pratikte bu proje için aylık maliyet sıfır.

## 1. Bucket oluştur

Cloudflare paneli → **R2** → *Create bucket*. İsim: `smartcontent` (veya istediğin).

## 2. Herkese açık erişimi aç

Bucket → **Settings** → *Public access*.

İki seçenek var:

| | Adres | Ne zaman |
|---|---|---|
| **r2.dev** | `https://pub-xxxx.r2.dev` | Deneme aşaması. Cloudflare hız sınırı uyguluyor, üretim için önerilmiyor. |
| **Özel alan adı** | `https://cdn.senin-alanadin.com` | Yayın. Alan adın Cloudflare'de olmalı. |

Şimdilik r2.dev ile başla, sonra alan adına geçersin. Aldığın adresi `R2_PUBLIC_BASE_URL` değişkenine yaz.

## 3. CORS kuralı ekle — bu adım atlanırsa yükleme çalışmaz

Tarayıcı dosyayı **doğrudan** R2'ye gönderiyor. Farklı alan adından yazma yapıldığı için bucket'ın buna izin vermesi gerekiyor.

Bucket → **Settings** → *CORS policy* → şunu yapıştır:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:8888",
      "https://SENIN-SITEN.netlify.app"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

`SENIN-SITEN` yerine Netlify adresini yaz. Yerel geliştirme için `localhost:8888` (netlify dev'in portu) gerekiyor.

## 4. API anahtarı üret

R2 → **Manage API tokens** → *Create API token*

- İzin: **Object Read & Write**
- Kapsam: sadece oluşturduğun bucket

Çıkan **Access Key ID** ve **Secret Access Key** değerlerini hemen kopyala — secret bir daha gösterilmiyor.

## 5. Değişkenleri gir

```bash
cp .env.example .env
```

Doldurulacaklar: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`

Netlify'da aynısı: **Site settings → Environment variables**.

## Nasıl çalışıyor?

```
1. Tarayıcı: kullanıcı görsel seçer
2. Tarayıcı: görseli JPEG'e çevirir, 1440px'e küçültür   ← ücretsiz, sunucu kullanmaz
3. Tarayıcı → upload-url fonksiyonu: "imzalı adres ver"
4. Fonksiyon → R2 anahtarıyla 5 dakikalık imzalı PUT adresi üretir
5. Tarayıcı → doğrudan R2'ye yükler                       ← dosya Netlify'dan geçmez
6. Tarayıcı → instagram-publish: "şu adresteki görseli paylaş"
7. Instagram → R2'den görseli indirir ve paylaşır
```

Dosya Netlify fonksiyonundan **geçmiyor** — bu yüzden 6 MB istek sınırına takılmıyor ve fonksiyon süresi harcamıyor.

## Tasarım notları

- **Neden JPEG'e çeviriyoruz?** Instagram API'si görsel için yalnızca JPEG kabul ediyor. PNG yüklersen paylaşım anında reddedilir. Tarayıcıda canvas ile çevirmek ücretsiz ve anında.
- **Dosya adını sunucu üretiyor.** İstemci yol seçemiyor, yoksa başkasının dosyasının üzerine yazabilirdi.
- **Boyut imzaya gömülü.** İmzalı adres, bildirilen boyuttan büyük bir dosya için kullanılamaz.
- **AWS SDK sağlama ayarı kapalı.** SDK 3.729'dan beri varsayılan olarak CRC32 sağlaması ekliyor; imzalama sırasında gövde olmadığı için *boş* gövdenin sağlamasını imzalıyor ve gerçek yükleme başarısız oluyor. `requestChecksumCalculation: 'WHEN_REQUIRED'` bunu kapatıyor.

## Sorun giderme

| Belirti | Sebep |
|---|---|
| Tarayıcı konsolunda CORS hatası | 3. adımdaki CORS kuralı eksik veya origin yanlış |
| `SignatureDoesNotMatch` | `R2_SECRET_ACCESS_KEY` yanlış, ya da imzalı adresin 5 dakikası dolmuş |
| Instagram `code 100` | `R2_PUBLIC_BASE_URL` yanlış veya bucket herkese açık değil — adresi gizli sekmede aç, açılıyor mu bak |
| Yükleme 403 | API anahtarında bucket için yazma izni yok |
