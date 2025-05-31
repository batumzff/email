const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

const BATCH_SIZE = 100;
const UNREAD_THRESHOLD = 1; // En az 1 okunmamış mesaj
const UNREAD_TIME_THRESHOLD = 30; // 30 dakika boyunca okunmamış mesaj varsa

async function processUnreadMessageEmails() {
  try {
    const now = new Date();
    const thresholdTime = new Date(now.getTime() - (UNREAD_TIME_THRESHOLD * 60 * 1000));

    // Match ve social kategorilerindeki kullanıcıları bul
    const users = await User.find({
      appCategory: { $in: ['match', 'social'] },
      unreadMessageCount: { $gte: UNREAD_THRESHOLD },
      lastUnreadMessageAt: { $lte: thresholdTime },
      lastMailSentAt: { $exists: false }
    })
    .select('email name appCategory appid unreadMessageCount')
    .lean();

    if (users.length > 0) {
      console.log(`[Unread Message Mail] ${users.length} kullanıcı için okunmamış mesaj bildirimi gönderilecek`);
      
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
              await sendToQueue('unread_message_email_jobs', {
                to: user.email,
                subject: 'Okunmamış Mesajınız Var!',
                category: user.appCategory,
                type: 'unread_message',
                templateVars: {
                  name: user.name,
                  appid: user.appid,
                  unreadCount: user.unreadMessageCount
                }
              });

              console.log(`[Unread Message Mail] Kullanıcı için okunmamış mesaj bildirimi gönderildi [${user._id}]`);
            }
          } catch (error) {
            console.error(`[Unread Message Mail] Kullanıcı için mail gönderim hatası [${user._id}]:`, error);
          }
        }));

        // Her batch arasında kısa bir bekleme
        if (i + BATCH_SIZE < users.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  } catch (error) {
    console.error('Unread message mail job hatası:', error);
  }
}

function startUnreadMessageJob() {
  // Her 5 dakikada bir çalış
  cron.schedule('*/5 * * * *', processUnreadMessageEmails);
  console.log('Unread message mail job başlatıldı');
}

module.exports = { startUnreadMessageJob }; 