# 📬 Email Microservice

## Proje Amacı

600.000 kayıtlı kullanıcıya sahip 6 farklı mobil uygulama için, günlük olarak kişiselleştirilmiş, kategoriye ve kullanıcı davranışına dayalı e-posta gönderimi gerçekleştiren Node.js tabanlı bir mikroservistir.

## Temel Özellikler
- Kullanıcının uygulama, kategori ve davranış bilgilerine göre ilgili e-posta şablonunu belirler.
- Her kullanıcıya günde sadece 1 kez e-posta gönderilmesini garanti eder.
- Hoşgeldin, geri dön çağrısı, eşleşme bildirimi, okunmamış mesaj bildirimi, meditasyon hatırlatması gibi senaryolara göre e-posta içeriğini dinamik olarak oluşturur.
- RabbitMQ kuyruğu ile e-posta gönderim sürecini asenkron şekilde yönetir.
- node-cron ile belirli aralıklarla çalışan job'lar ile kullanıcı listelerini ve durumlarını kontrol eder.
- E-posta açılma saatlerini analiz ederek, en verimli saatte gönderim yapacak şekilde dinamik zamanlama uygular.

## Ekstra Yapılan İyileştirmeler
1. **Mail Plan ve Sending Job Optimizasyonu:**
   - Tüm mail senaryoları tek bir job'da birleştirildi
   - MailPlan modeli ile merkezi mail yönetimi
   - Batch işleme eklendi (her batch'te 100 mail)
   - MongoDB sorguları optimize edildi (index ve lean queries)
   - Atomic update ile lastMailSentAt güncellemesi
   - Paralel işleme için Promise.all kullanımı
   - 30 dakikalık pencere ile mail işleme

2. **User Model İyileştirmeleri:**
   - createdAt alanına index eklendi
   - Gereksiz alanlar temizlendi
   - Schema yapısı sadeleştirildi

3. **RabbitMQ İyileştirmeleri:**
   - Retry mekanizması eklendi (maksimum 3 deneme)
   - Dead Letter Queue (DLQ) implementasyonu
   - Queue önceliklendirme ve yönetimi

4. **Genel İyileştirmeler:**
   - Docker ve Docker Compose yapılandırması
   - Loglama ve hata yönetimi geliştirmeleri

5. **Job Lock Mekanizması İyileştirmeleri:**
   - Kilit süresi 10 dakikaya düşürüldü
   - Her 5 dakikada bir kilit yenileme mekanizması eklendi
   - Batch işleme sırasında kilit yenileme
   - İlerleme durumu daha sık güncelleniyor
   - Race condition'lar önlendi
   - Distributed sistem desteği iyileştirildi
   - Her batch sonrası ilerleme durumu güncelleniyor
   - Hata durumunda otomatik kilit serbest bırakma

## Önemli Notlar
1. **Job Çalışma Sıklığı:**
   - Her 5 dakikada bir çalışır
   - 30 dakikalık pencere içindeki mailleri işler
   - Her batch'te maksimum 1000 mail işlenir
   - Batch'ler 100'er mail olarak işlenir

2. **Kilit Mekanizması:**
   - Kilit süresi: 10 dakika
   - Yenileme sıklığı: 5 dakika
   - Batch işleme sırasında otomatik yenileme
   - Hata durumunda otomatik serbest bırakma

3. **Retry Mekanizması:**
   - Maksimum 3 deneme
   - Deneme aralıkları: 5, 15, 30 dakika
   - Her denemede detaylı loglama
   - Maksimum deneme sonrası kalıcı hata olarak işaretleme

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

- [x] **Job çakışma kontrolü:** Tüm job'lar için isProcessing flag'i eklenerek çakışmalar önlenebilir.
- [x] **Batch işleme optimizasyonu:** Diğer job'lar için de batch işleme ve paralel işleme mekanizmaları eklenebilir.
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

## Mimarinin Akışı
1. **Mail Plan**: Tüm mail senaryoları için merkezi planlama
   - Hoşgeldin mailleri
   - Geri dön çağrısı mailleri
   - Eşleşme bildirimi mailleri
   - Okunmamış mesaj bildirimi mailleri
   - Meditasyon hatırlatması mailleri

2. **Mail Sending Job**: Merkezi mail gönderim job'ı
   - Her 5 dakikada bir çalışır
   - 30 dakikalık pencere içindeki mailleri işler
   - Batch işleme ile performans optimizasyonu
   - Kilit mekanizması ile çakışmaları önler

3. **RabbitMQ Kuyruğu**: Asenkron mail gönderimi
   - `email_jobs` queue'su
   - Retry mekanizması
   - Dead Letter Queue

4. **Şablonlar**: Pug ile yazılmış, ortak header/footer kullanan, dinamik içerikli e-posta şablonları

5. **Tracking Pixel**: E-posta açılma saatleri takip edilir ve MongoDB'ye kaydedilir

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





