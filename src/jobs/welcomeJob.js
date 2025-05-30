const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

async function processWelcomeEmails() {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 dakika öncesi

    // Son 1 dakikada oluşturulmuş kullanıcıları bul
    const users = await User.find({
      createdAt: { 
        $gte: oneMinuteAgo,
        $lte: now
      }
    });

    if (users.length > 0) {
      console.log(`[Welcome Mail] Son 1 dakikada ${users.length} yeni kullanıcı bulundu`);
      
      // Her kullanıcı için welcome mail gönder
      for (const user of users) {
        try {
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
        } catch (error) {
          console.error(`[Welcome Mail] Kullanıcı için welcome mail gönderim hatası [${user._id}]:`, error);
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
