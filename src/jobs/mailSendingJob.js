const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const MailPlan = require('../models/MailPlan');

const BATCH_SIZE = 1000;
const TIME_WINDOW = 30; // 30 dakikalık pencere
const RETRY_DELAYS = [5, 15, 30]; // Retry için bekleme süreleri (dakika)

// Son işlenen zamanı tut
let lastProcessedTime = null;

async function getMailSubject(mailType, templateVars) {
  const subjects = {
    welcome: 'Hoş Geldiniz!',
    unread_message: `${templateVars.unreadCount} Okunmamış Mesajınız Var!`,
    match: 'Yeni Eşleşmeniz Var!',
    come_back: 'Sizi Özledik!',
    meditation_reminder: 'Meditasyon Zamanı!'
  };
  return subjects[mailType] || 'Bildirim';
}

async function sendPlannedMails() {
  const jobStartTime = new Date();
  console.log(`[Mail Sending] Job başladı - ${jobStartTime.toISOString()}`);

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (TIME_WINDOW/2) * 60000); // 15 dk öncesi
    const windowEnd = new Date(now.getTime() + (TIME_WINDOW/2) * 60000);   // 15 dk sonrası

    // Eğer son işlenen zaman varsa, ondan sonraki mailleri al
    const queryStart = lastProcessedTime || windowStart;
    console.log(`[Mail Sending] Zaman penceresi: ${queryStart.toISOString()} - ${windowEnd.toISOString()}`);

    // 30 dakikalık pencere içindeki mailleri bul
    const mailsToSend = await MailPlan.find({
      status: 'pending',
      plannedSendTime: { 
        $gte: queryStart,
        $lte: windowEnd
      }
    })
    .limit(BATCH_SIZE)
    .lean();

    if (mailsToSend.length > 0) {
      console.log(`[Mail Sending] ${mailsToSend.length} mail gönderilecek`);

      // Başarılı ve başarısız mailleri grupla
      const successfulMails = [];
      const failedMails = [];
      const maxRetryMails = [];

      // Tüm mailleri paralel işle
      await Promise.all(mailsToSend.map(async (mail) => {
        try {
          const subject = await getMailSubject(mail.mailType, mail.templateVars);

          await sendToQueue('email_jobs', {
            to: mail.email,
            subject: subject,
            category: mail.category,
            type: mail.mailType,
            templateVars: mail.templateVars
          });

          successfulMails.push(mail._id);
          console.log(`[Mail Sending] Mail queue'ya eklendi [${mail._id}] - ${mail.email} - ${mail.mailType}`);
        } catch (error) {
          // Hata durumunda retry planla
          const retryCount = mail.retryCount || 0;
          if (retryCount < RETRY_DELAYS.length) {
            const retryDelay = RETRY_DELAYS[retryCount];
            const retryTime = new Date(now.getTime() + retryDelay * 60000);

            failedMails.push({
              _id: mail._id,
              retryTime,
              retryCount: retryCount + 1,
              error: error.message
            });

            console.log(`[Mail Sending] Mail tekrar planlandı [${mail._id}] - ${mail.email} - ${retryDelay} dk sonra - Hata: ${error.message}`);
          } else {
            maxRetryMails.push({
              _id: mail._id,
              error: `Maksimum retry sayısına ulaşıldı: ${error.message}`
            });

            console.error(`[Mail Sending] Mail gönderim hatası [${mail._id}] - ${mail.email} - ${error.message}`);
          }
        }
      }));

      // Toplu güncellemeler
      if (successfulMails.length > 0) {
        await MailPlan.updateMany(
          { _id: { $in: successfulMails } },
          { $set: { status: 'queued' } }  // Status'u 'queued' olarak güncelle
        );
        console.log(`[Mail Sending] ${successfulMails.length} mail queue'ya eklendi`);
      }

      if (failedMails.length > 0) {
        await MailPlan.updateMany(
          { _id: { $in: failedMails.map(m => m._id) } },
          { 
            $set: { 
              status: 'failed',
              lastError: { $each: failedMails.map(m => m.error) },
              plannedSendTime: { $each: failedMails.map(m => m.retryTime) }
            },
            $inc: { retryCount: 1 }
          }
        );
        console.log(`[Mail Sending] ${failedMails.length} mail tekrar planlandı`);
      }

      if (maxRetryMails.length > 0) {
        await MailPlan.updateMany(
          { _id: { $in: maxRetryMails.map(m => m._id) } },
          { 
            $set: { 
              status: 'failed',
              lastError: { $each: maxRetryMails.map(m => m.error) }
            }
          }
        );
        console.log(`[Mail Sending] ${maxRetryMails.length} mail maksimum retry sayısına ulaştı`);
      }
    } else {
      console.log('[Mail Sending] Gönderilecek mail bulunamadı');
    }

    // Son işlenen zamanı güncelle
    lastProcessedTime = windowEnd;
    console.log(`[Mail Sending] Son işlenen zaman güncellendi: ${lastProcessedTime.toISOString()}`);

    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000;
    console.log(`[Mail Sending] Job tamamlandı - ${jobEndTime.toISOString()} - Süre: ${duration} saniye`);
  } catch (error) {
    console.error('[Mail Sending] Hata:', error);
    // Hata durumunda alert gönder
    // TODO: Alert mekanizması eklenecek
  }
}

function startMailSendingJob() {
  console.log('[Mail Sending] Job başlatılıyor...');
  // Her 5 dakikada bir çalış
  cron.schedule('*/5 * * * *', sendPlannedMails);
  console.log('[Mail Sending] Job başlatıldı - Her 5 dakikada bir çalışacak');
}

module.exports = { mailSendingJob: { start: startMailSendingJob } }; 