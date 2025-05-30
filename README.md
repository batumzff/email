# 📬 Email Microservice

## Proje Amacı

600.000 kayıtlı kullanıcıya sahip 6 farklı mobil uygulama için, günlük olarak kişiselleştirilmiş, kategoriye ve kullanıcı davranışına dayalı e-posta gönderimi gerçekleştiren Node.js tabanlı bir mikroservistir.

## Temel Özellikler
- Kullanıcının uygulama, kategori ve davranış bilgilerine göre ilgili e-posta şablonunu belirler.
- Her kullanıcıya günde sadece 1 kez e-posta gönderilmesini garanti eder.
- Hoşgeldin, geri dön çağrısı, eşleşme bildirimi, okunmamış mesaj bildirimi, meditasyon hatırlatması gibi senaryolara göre e-posta içeriğini dinamik olarak oluşturur.
- RabbitMQ kuyruğu ile e-posta gönderim sürecini asenkron şekilde yönetir.
- node-cron ile belirli aralıklarla çalışan job'lar ile kullanıcı listelerini ve durumlarını kontrol eder.
- E-posta açılma saatlerini analiz ederek, en verimli saatte gönderim yapacak şekilde dinamik zamanlama uygular (özellikle meditasyon hatırlatması için).

## Ekstra Yapılan İyileştirmeler
1. **Welcome Job Optimizasyonu:**
   - Batch işleme eklendi (her batch'te 100 kullanıcı)
   - MongoDB sorguları optimize edildi (index ve lean queries)
   - Atomic update ile lastMailSentAt güncellemesi
   - Paralel işleme için Promise.all kullanımı
   - Kullanıcı kaçırma riskini azaltmak için 2 dakikalık pencere

2. **User Model İyileştirmeleri:**
   - createdAt alanına index eklendi
   - Gereksiz alanlar temizlendi (unreadMessageCount)
   - Schema yapısı sadeleştirildi

3. **RabbitMQ İyileştirmeleri:**
   - Retry mekanizması eklendi (maksimum 3 deneme)
   - Dead Letter Queue (DLQ) implementasyonu
   - Queue önceliklendirme ve yönetimi

4. **Genel İyileştirmeler:**
   - Docker ve Docker Compose yapılandırması
   - Loglama ve hata yönetimi geliştirmeleri

## Kurulum

### Docker ile Kurulum (Önerilen)

1. Docker ve Docker Compose'u yükleyin
2. `.env` dosyasını oluşturun:
   ```bash
   cp .env.example .env
   ```
3. `.env` dosyasını düzenleyin ve gerekli değişkenleri ayarlayın
4. Docker container'larını başlatın:
   ```bash
   docker-compose up -d
   ```

### Manuel Kurulum

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
2. `.env` dosyasını oluşturun ve gerekli ayarları girin:
   ```env
   MONGO_URI=mongodb://localhost:27017/email_microservice
   RABBITMQ_URL=amqp://localhost
   SMTP_HOST=...
   SMTP_PORT=...
   SMTP_USER=...
   SMTP_PASS=...
   MAIL_FROM=no-reply@example.com
   ```
3. MongoDB ve RabbitMQ'yu yükleyin ve başlatın
4. Uygulamayı başlatın:
   ```bash
   npm start
   ```

## Test ve İzleme

### Docker ile
- RabbitMQ yönetim paneli: http://localhost:15672 (kullanıcı adı/şifre: guest/guest)
- MongoDB: localhost:27017
- Uygulama: http://localhost:3000

### Manuel Kurulum ile
- RabbitMQ yönetim paneli: http://localhost:15672
- MongoDB: localhost:27017
- Uygulama: http://localhost:3000

## Gelişmiş Özellikler
- Her kullanıcıya günde sadece 1 mail gönderimi `lastMailSentAt` alanı ile garanti edilir.
- E-posta açılma saatleri analiz edilerek, özellikle meditasyon hatırlatması için en verimli gönderim saati otomatik olarak belirlenir.
- Ortak header/footer ile profesyonel ve tutarlı e-posta şablonları.
- Her senaryo için ayrı queue ve consumer ile yüksek ölçeklenebilirlik ve önceliklendirme.

## Katkı ve Lisans
- Katkıda bulunmak için pull request gönderebilirsiniz.
- MIT Lisansı ile lisanslanmıştır.

## TODO & İyileştirme Önerileri

- [ ] **Mail gönderiminde retry ve dead-letter queue:** Hatalı gönderimler için otomatik tekrar deneme ve başarısız işler için ayrı bir dead-letter queue eklenmeli.
- [ ] **Unit ve entegrasyon testleri:** Otomatik testler (Jest/Mocha) ile senaryo, şablon ve mail gönderim fonksiyonları test edilmeli.
- [ ] **Kullanıcıya özel gönderim saati:** Şu anda kategori bazında dinamik saat var, kullanıcıya özel saat için ek analiz ve yapı eklenebilir.
- [ ] **Mail gönderiminde rate limit:** SMTP veya provider limitleri için rate limit mekanizması eklenmeli.
- [ ] **Mail gönderiminde queue önceliklendirme:** Kritik senaryolar için queue önceliği veya ayrı worker ölçeklendirmesi yapılabilir.
- [ ] **Şablonlarda çoklu dil desteği:** Pug şablonları ve subject'ler için i18n (çoklu dil) desteği eklenebilir.
- [ ] **Mail gönderim raporları ve dashboard:** Gönderim, açılma, tıklanma oranları için bir admin paneli veya dashboard eklenebilir.
- [ ] **Kapsamlı loglama ve merkezi log yönetimi:** Loglar merkezi bir servise (ELK, Loki, vs.) yönlendirilebilir.
- [ ] **Kapsamlı hata yönetimi:** Tüm job ve consumer'larda daha detaylı hata yönetimi ve alert mekanizması eklenebilir.
- [ ] **Kuyrukta biriken mesajlar için monitoring:** RabbitMQ kuyruklarının doluluk ve işlenme durumları için otomatik monitoring ve alerting eklenebilir.
- [ ] **Batch işleme optimizasyonu:** Diğer job'lar için de batch işleme ve paralel işleme mekanizmaları eklenebilir.
- [ ] **Job çakışma kontrolü:** Tüm job'lar için isProcessing flag'i eklenerek çakışmalar önlenebilir.

## Mimarinin Akışı
1. **Job'lar**: Her senaryo için ayrı job dosyası vardır (ör: welcome, match, unread, meditation reminder, come back). Her job kendi kuyruğuna iş atar.
2. **RabbitMQ Kuyrukları**: Her senaryo için ayrı queue kullanılır. (Ör: `welcome_email_jobs`, `match_email_jobs`)
3. **Consumer'lar**: Her queue için ayrı consumer başlatılır ve ilgili e-posta gönderimini gerçekleştirir.
4. **Şablonlar**: Pug ile yazılmış, ortak header/footer kullanan, dinamik içerikli e-posta şablonları.
5. **Tracking Pixel**: E-posta açılma saatleri takip edilir ve MongoDB'ye kaydedilir.
6. **Analiz Job'u**: Okundu saatlerini analiz ederek, en verimli gönderim saatini belirler ve job'ların zamanlamasını dinamik hale getirir.

## Kullanılan Teknolojiler
- Node.js
- Express.js
- Mongoose (MongoDB)
- amqplib (RabbitMQ)
- node-cron
- Pug (template engine)
- Nodemailer

## Test ve İzleme
- Job ve consumer loglarını terminalden takip edin.
- RabbitMQ yönetim panelinden (varsayılan: http://localhost:15672) kuyrukları ve mesaj akışını izleyin.
- MongoDB'de `OpenedMail` ve `SendHourSetting` koleksiyonlarını kontrol edin.
- Test kullanıcıları ekleyerek, mail gönderimi ve açılma takibini gözlemleyin.





