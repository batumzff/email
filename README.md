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

## Kurulum
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
3. Uygulamayı başlatın:
   ```bash
   npm start
   ```

## Test ve İzleme
- Job ve consumer loglarını terminalden takip edin.
- RabbitMQ yönetim panelinden (varsayılan: http://localhost:15672) kuyrukları ve mesaj akışını izleyin.
- MongoDB'de `OpenedMail` ve `SendHourSetting` koleksiyonlarını kontrol edin.
- Test kullanıcıları ekleyerek, mail gönderimi ve açılma takibini gözlemleyin.

## Gelişmiş Özellikler
- Her kullanıcıya günde sadece 1 mail gönderimi `lastMailSentAt` alanı ile garanti edilir.
- E-posta açılma saatleri analiz edilerek, özellikle meditasyon hatırlatması için en verimli gönderim saati otomatik olarak belirlenir.
- Ortak header/footer ile profesyonel ve tutarlı e-posta şablonları.
- Her senaryo için ayrı queue ve consumer ile yüksek ölçeklenebilirlik ve önceliklendirme.

## Katkı ve Lisans
- Katkıda bulunmak için pull request gönderebilirsiniz.
- MIT Lisansı ile lisanslanmıştır.

## TODO & İyileştirme Önerileri

- [ ] **Gerçek unread mesaj kontrolü:** Şu anda unreadMessageJob'da gerçek bir mesaj tablosu kontrolü yok, gerçek mesaj tablosu ile entegre edilmeli.
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




MONGODB_URI=mongodb+srv://batuhanmuzafferoglu:Batu5553845635.@cluster0.tfyiq.mongodb.net/email_microservice?retryWrites=true&w=majority&appName=Cluster0
PORT=3000
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
MAIL_FROM=no-reply@example.com
RABBITMQ_URL=amqp://localhost
