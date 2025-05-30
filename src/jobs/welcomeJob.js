const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

const BATCH_SIZE = 100; // Her batch'te işlenecek kullanıcı sayısı

async function processWelcomeEmails() {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const twoMinutesAgo = new Date(now.getTime() - 120000);

    // Son 2 dakikada oluşturulmuş ama son 1 dakikada işlenmemiş kullanıcıları bul
    const users = await User.find({
      createdAt: { 
        $gte: twoMinutesAgo,
        $lte: now
      },
      lastMailSentAt: { $exists: false }
    })
    .select('email name appCategory appid')
    .lean();

    if (users.length > 0) {
      console.log(`[Welcome Mail] Son 2 dakikada ${users.length} yeni kullanıcı bulundu`);
      
      // Batch işleme
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        
        // Batch'teki kullanıcılar için paralel işlem
        await Promise.all(batch.map(async (user) => {
          try {
            // Atomic update ile lastMailSentAt'i güncelle
            const updated = await User.updateOne(
              { 
                _id: user._id,
                lastMailSentAt: { $exists: false }
              },
              { $set: { lastMailSentAt: new Date() } }
            );

            if (updated.nModified === 1 || updated.modifiedCount === 1) {
              await sendToQueue('welcome_email_jobs', {
                to: user.email,
                subject: 'Hoş Geldiniz!',
                category: user.appCategory,
                type: 'welcome',
                templateVars: {
                  name: user.name,
                  appid: user.appid
                }
              });

              console.log(`[Welcome Mail] Kullanıcı için welcome maili gönderildi [${user._id}]`);
            }
          } catch (error) {
            console.error(`[Welcome Mail] Kullanıcı için welcome mail gönderim hatası [${user._id}]:`, error);
          }
        }));

        // Her batch arasında kısa bir bekleme
        if (i + BATCH_SIZE < users.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  } catch (error) {
    console.error('Welcome mail job hatası:', error);
  }
}

function startWelcomeJob() {
  // Her dakika çalış
  cron.schedule('* * * * *', processWelcomeEmails);
  console.log('Welcome mail job başlatıldı');
}

module.exports = { startWelcomeJob };
