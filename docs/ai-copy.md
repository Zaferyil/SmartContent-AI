# Görselden metin üretimi

Metinler artık şablon değil — Claude **görseli görüyor** ve resimde ne varsa ona göre yazıyor.

## Kurulum

1. https://console.anthropic.com → **API keys** → **Create key**
2. `.env` dosyasına ekle:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Netlify'da: **Site settings → Environment variables**.

## Nasıl çalışıyor

```
Görsel R2'ye yüklenir → herkese açık URL oluşur
        ↓
Claude o URL'den görseli okur
        ↓
Marka brifingi + üslup + biçim ile metni yazar
```

Anahtar sunucuda durur; tarayıcı Claude'a doğrudan istek atmaz.

## Marka brifingi

`netlify/functions/generate-caption.js` içindeki `BRAND_BRIEF` sabiti metnin sesini belirliyor. Şu an:

- **Kitle:** 5-12 yaş çocukların ebeveynleri
- **Amaç:** ebeveyni çocuğunu kursa yazdırmaya istekli kılmak
- **Ses:** sıcak, motive edici, somut; korku veya kıyas yok
- **Emoji:** anlam taşıdığı yerlerde, aşırıya kaçmadan

### Sert sınırlar (yazılı olarak yasak)

Model pazarlama metni yazarken uydurmaya meyillidir. Brifingte şunlar açıkça yasaklandı:

- Fiyat, tarih, ders saati, adres, indirim, kontenjan uydurmak
- Sonuç vaadi ("çocuğunuz sınıfın birincisi olur")
- Fotoğraftaki çocuğun öğrenci olduğunu iddia etmek, isim vermek
- Suçluluk duygusu veya diğer çocuklarla kıyas

Sesi değiştirmek istersen bu sabiti düzenle — sınırları kaldırma.

## Seçenekler

| Alan | Etkisi |
|---|---|
| **Biçim** | Gönderi metni · Hashtag seti · Hook · CTA · Seri |
| **Üslup** | Samimi · Profesyonel · Eğlenceli · İddialı |
| **Gönderi türü** | Story seçilirse metin iki satıra iner (Story'de yazı görselin üstünde durur) |
| **Yön ver** | İsteğe bağlı: "kayda teşvik et", "konsantrasyonu öne çıkar" gibi |
| **Dil** | Arayüz dili neyse o (İngilizce / Almanca) |

## Model ve maliyet

`claude-opus-5`, düşük effort ile — kısa yaratıcı bir iş, derin akıl yürütme gerekmiyor ve Netlify'ın 10 saniyelik fonksiyon limitine sığması gerekiyor.

Kabaca gönderi başına **$0.01-0.02**. Günde 12 gönderi ≈ **ayda $4-7**.

Daha ucuzu gerekirse `generate-caption.js` içindeki model satırını `claude-sonnet-5` yapabilirsin (girdi $2 / çıktı $10 per MTok — yaklaşık yarı fiyat). Metin kalitesi bir miktar düşer; karar senin.

## Doğrulandı

Gerçek kullanımda çalıştı. Bir BrainFit Kids afişi yüklendiğinde model afişteki başparmak işaretini, abaküsü, marka adını, *"online & vor Ort"* ve *"ab 5 Jahren"* bilgilerini metne taşıdı — yani görseli okuduğu şablonla açıklanamaz. Fiyat veya tarih uydurmadı; sınırlar tuttu.

Almanca çıktı çeviri gibi değil, doğal kurulmuş cümlelerle geldi.

Süre 10 saniye limitinin rahatça altında kaldı, yani yayınlamada yaptığımız gibi ikiye bölmeye gerek yok. Bu düşük effort tercihine bağlı — effort yükseltilirse süre de artar, o zaman yeniden ölçülmeli.

## Bilinen sınırlar

- **Marka brifingi tek bir işletmeye göre yazılı.** Başka bir sektör için `BRAND_BRIEF` baştan yazılmalı.
- **Metin kaydedilmiyor.** Üretilen metin sadece ekranda; sayfayı yenilersen gider. Kuyruk ve veritabanı gelince çözülecek.
