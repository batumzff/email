const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');
const SendHourSetting = require('../models/SendHourSetting');

let isProcessing = false; // İşlem durumunu takip etmek için

async function processMeditationReminders() {
  try {
    // Eğer zaten işlem yapılıyorsa, yeni işlem başlatma
    if (isProcessing) {
      console.log('Önceki işlem devam ediyor, yeni işlem başlatılmıyor');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentHour = new Date().getHours();

    // En verimli saati al
    const sendHourSetting = await SendHourSetting.findOne({ category: 'meditation' });
    const optimalHour = sendHourSetting ? sendHourSetting.sendHour : 9;

    // Eğer şu anki saat, optimal saat değilse işlem yapma
    if (currentHour !== optimalHour) {
      console.log(`Şu anki saat (${currentHour}) optimal saat (${optimalHour}) değil, işlem yapılmayacak`);
      return;
    }

    // İşlem başladığını işaretle
    isProcessing = true;

    // Toplam işlenecek kullanıcı sayısını hesapla
    const totalUsers = await User.countDocuments({
      appCategory: 'meditation',
      $or: [
        { lastMailSentAt: { $exists: false } },
        { lastMailSentAt: { $lt: today } }
      ]
    });

    // 2 saat içinde tamamlanacak şekilde dakikada işlenecek kullanıcı sayısını hesapla
    const MINUTES_IN_TWO_HOURS = 120;
    const usersPerMinute = Math.ceil(totalUsers / MINUTES_IN_TWO_HOURS);

    console.log(`[${optimalHour}:00] Toplam işlenecek kullanıcı: ${totalUsers}`);
    console.log(`[${optimalHour}:00] Dakikada işlenecek kullanıcı: ${usersPerMinute}`);

    // Kullanıcıları işle
    const users = await User.find({
      appCategory: 'meditation',
      $or: [
        { lastMailSentAt: { $exists: false } },
        { lastMailSentAt: { $lt: today } }
      ]
    })
    .sort({ lastMailSentAt: 1 }) // En eski mail gönderilmemiş olanlar önce
    .limit(usersPerMinute);

    for (const user of users) {
      try {
        const updated = await User.updateOne(
          { 
            _id: user._id,
            $or: [
              { lastMailSentAt: { $exists: false } },
              { lastMailSentAt: { $lt: today } }
            ]
          },
          { $set: { lastMailSentAt: new Date() } }
        );
        
        if (updated.nModified === 1 || updated.modifiedCount === 1) {
          await sendToQueue('meditation_email_jobs', {
            to: user.email,
            subject: 'Meditasyon Zamanı!',
            category: 'meditation',
            type: 'reminder',
            templateVars: {
              name: user.name,
              appName: user.appName
            }
          });
        }
      } catch (error) {
        console.error(`Kullanıcı için kuyruğa ekleme hatası [${user._id}]:`, error);
      }
    }

    console.log(`[${optimalHour}:00] İşlem tamamlandı. İşlenen kullanıcı sayısı: ${users.length}`);

    // İşlem bittiğini işaretle
    isProcessing = false;
  } catch (error) {
    console.error('Meditation reminder job hatası:', error);
    isProcessing = false; // Hata durumunda da işlem durumunu sıfırla
  }
}

function startMeditationReminderJob() {
  // Her saat başı çalış
  cron.schedule('0 * * * *', processMeditationReminders);
  console.log('Meditation reminder job başlatıldı');
}

module.exports = { startMeditationReminderJob };
