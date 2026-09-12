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

## Bilinen riskler

- **10 saniye limiti.** Opus 5 bir görseli okuyup metin yazarken bu sınıra yaklaşabilir. Düşük effort bunun için seçildi ama gerçek ölçüm yapılmadı — ilk denemelerde sunucu penceresindeki süreye bak. Sürekli zaman aşımı olursa yayınlamada yaptığımız gibi bu da iki adıma bölünmeli.
- **Canlı çağrı test edilmedi.** Doğrulama yolları test edildi; asıl API çağrısı geliştirme ortamında anahtar olmadığı için denenemedi. İlk çalıştıran sen olacaksın.
