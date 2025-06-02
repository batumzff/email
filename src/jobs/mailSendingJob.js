const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const MailPlan = require('../models/MailPlan');
const User = require('../models/User');
const JobState = require('../models/JobState');
const { retryMongoDBOperation, retry } = require('../utils/retry');
const mongoose = require('mongoose');

const BATCH_SIZE = 1000;
const TIME_WINDOW = 30; // 30 dakikalık pencere
const RETRY_DELAYS = [5, 15, 30]; // Retry için bekleme süreleri (dakika)

// Günün başlangıcını hesapla
function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// Kullanıcıya mail gönderim izni kontrolü ve güncelleme
async function checkAndUpdateUserMailPermission(userId, now) {
  return await User.findOneAndUpdate(
    { 
      _id: userId,
      $or: [
        { lastMailSentAt: { $exists: false } }, // Hiç mail gönderilmemiş
        { lastMailSentAt: { $lt: startOfDay(now) } } // Son mail bugünden önce
      ]
    },
    { $set: { lastMailSentAt: now } },
    { new: true }
  );
}

async function getJobState() {
  const state = await JobState.findOneAndUpdate(
    { jobName: 'mailSending' },
    { 
      $setOnInsert: { 
        jobName: 'mailSending',
        lastProcessedTime: new Date(0)
      }
    },
    { 
      upsert: true,
      new: true
    }
  );
  return state;
}

async function updateJobState(lastProcessedTime, isProcessing = false, error = null) {
  await JobState.updateMany(
    { jobName: 'mailSending' },
    { 
      $set: { 
        lastProcessedTime,
        isProcessing,
        lastError: error,
        updatedAt: new Date()
      }
    }
  );
}

async function acquireJobLock() {
  const result = await JobState.findOneAndUpdate(
    { 
      jobName: 'mailSending',
      isProcessing: false,
      $or: [
        { updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } }, // 30 dakikadan eski
        { updatedAt: { $exists: false } }
      ]
    },
    { 
      $set: { 
        isProcessing: true,
        updatedAt: new Date()
      }
    },
    { new: true }
  );
  return result !== null;
}

async function sendPlannedMails() {
  const jobStartTime = new Date();
  console.log(`[Mail Sending] Job başladı - ${jobStartTime.toISOString()}`);

  try {
    // Job state'i kontrol et
    const jobState = await getJobState();
    if (jobState.isProcessing) {
      console.log('[Mail Sending] Job zaten çalışıyor, atlanıyor...');
      return;
    }

    // Job kilidi al
    const lockAcquired = await acquireJobLock();
    if (!lockAcquired) {
      console.log('[Mail Sending] Job kilidi alınamadı, atlanıyor...');
      return;
    }

    // Job'ı işleniyor olarak işaretle
    await updateJobState(jobState.lastProcessedTime, true);

    const now = new Date();
    const windowStart = new Date(now.getTime() - TIME_WINDOW * 60000);
    const windowEnd = now;

    // Son işlenen zamandan sonraki mailleri al
    const queryStart = new Date(Math.max(
      jobState.lastProcessedTime.getTime(),
      windowStart.getTime()
    ));

    console.log(`[Mail Sending] Zaman penceresi: ${queryStart.toISOString()} - ${windowEnd.toISOString()}`);

    // 30 dakikalık pencere içindeki mailleri bul
    const mailsToSend = await retryMongoDBOperation(async () => {
      return MailPlan.find({
        status: 'pending',
        plannedSendTime: { 
          $gte: queryStart,
          $lte: windowEnd
        }
      })
      .limit(BATCH_SIZE)
      .lean();
    });

    if (mailsToSend.length > 0) {
      console.log(`[Mail Sending] ${mailsToSend.length} mail gönderilecek`);

      // Başarılı ve başarısız mailleri grupla
      const successfulMails = [];
      const failedMails = [];
      const maxRetryMails = [];

      // Tüm mailleri paralel işle
      await Promise.all(mailsToSend.map(async (mail) => {
        try {
          // Race condition'ı önlemek için atomik işlem
          const updatedUser = await checkAndUpdateUserMailPermission(mail.userId, now);
          
          if (!updatedUser) {
            console.log(`[Mail Sending] Kullanıcıya bugün zaten mail gönderilmiş [${mail.userId}]`);
            return;
          }

          // Maili processing durumuna al
          const updated = await MailPlan.findOneAndUpdate(
            { 
              _id: mail._id,
              status: 'pending'
            },
            { 
              $set: { 
                status: 'processing',
                processingStartedAt: now
              }
            }
          );

          if (!updated) {
            console.log(`[Mail Sending] Mail zaten işleniyor [${mail._id}]`);
            return;
          }

          await retry(async () => {
            await sendToQueue('email_jobs', {
              to: mail.email,
              category: mail.category,
              type: mail.mailType,
              templateVars: mail.templateVars,
              userId: mail.userId,
              mailId: mail._id
            });
          }, {
            maxAttempts: 3,
            initialDelay: 1000,
            onRetry: (error, attempt) => {
              console.log(`Mail gönderme hatası [${mail._id}] (Deneme ${attempt}/3): ${error.message}`);
            }
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
        await retryMongoDBOperation(async () => {
          const session = await mongoose.startSession();
          await session.withTransaction(async () => {
            // Mail planlarını güncelle
            await MailPlan.updateMany(
              { _id: { $in: successfulMails } },
              { 
                $set: { 
                  status: 'sent',
                  sentAt: now
                }
              },
              { session }
            );

            // User tablosundaki lastMailSentAt'ı güncelle
            await User.updateMany(
              { _id: { $in: mailsToSend.filter(m => successfulMails.includes(m._id)).map(m => m.userId) } },
              { 
                $set: { 
                  lastMailSentAt: now
                }
              },
              { session }
            );
          });
        });
        console.log(`[Mail Sending] ${successfulMails.length} mail başarıyla gönderildi`);
      }

      if (failedMails.length > 0) {
        await retryMongoDBOperation(async () => {
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
        });
        console.log(`[Mail Sending] ${failedMails.length} mail tekrar planlandı`);
      }

      if (maxRetryMails.length > 0) {
        await retryMongoDBOperation(async () => {
          await MailPlan.updateMany(
            { _id: { $in: maxRetryMails.map(m => m._id) } },
            { 
              $set: { 
                status: 'permanently_failed',
                lastError: { $each: maxRetryMails.map(m => m.error) }
              }
            }
          );
        });
        console.log(`[Mail Sending] ${maxRetryMails.length} mail maksimum retry sayısına ulaştı`);
      }
    } else {
      console.log('[Mail Sending] Gönderilecek mail bulunamadı');
    }

    // Job state'i güncelle
    await updateJobState(windowEnd, false);
    
    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000;
    console.log(`[Mail Sending] Job tamamlandı - ${jobEndTime.toISOString()} - Süre: ${duration} saniye`);
  } catch (error) {
    console.error('[Mail Sending] Hata:', error);
    // Hata durumunda job state'i güncelle
    await updateJobState(jobState.lastProcessedTime, false, error.message);
    // TODO: Alert mekanizması eklenecek
  }
}

// Yardımcı fonksiyon: İki tarihin aynı güne ait olup olmadığını kontrol et
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function startMailSendingJob() {
  console.log('[Mail Sending] Job başlatılıyor...');
  // Her 5 dakikada bir çalış
  cron.schedule('*/5 * * * *', sendPlannedMails);
  console.log('[Mail Sending] Job başlatıldı - Her 5 dakikada bir çalışacak');
}

module.exports = { mailSendingJob: { start: startMailSendingJob } }; 