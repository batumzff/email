const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

async function processUnreadMessageEmails() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Tüm kategorileri al
    const categories = await User.distinct('appCategory');
    
    // Her kategori için ayrı işlem yap
    for (const category of categories) {
      try {
        // Bu kategori için toplam işlenecek kullanıcı sayısını hesapla
        const totalUsersInCategory = await User.countDocuments({
          appCategory: category,
          unreadMessageCount: { $gt: 0 },
          $or: [
            { lastMailSentAt: { $exists: false } },
            { lastMailSentAt: { $lt: today } }
          ]
        });

        // Her çalışmada işlenecek kullanıcı sayısını hesapla
        // 15 dakikada bir çalıştığı için günde 96 çalışma olacak
        const batchSize = Math.ceil(totalUsersInCategory / 96);

        const users = await User.find({
          appCategory: category,
          unreadMessageCount: { $gt: 0 },
          $or: [
            { lastMailSentAt: { $exists: false } },
            { lastMailSentAt: { $lt: today } }
          ]
        })
        .sort({ unreadMessageCount: -1 }) // En çok okunmamış mesajı olanlar önce
        .limit(batchSize);

        // Bu kategorideki kullanıcıları işle
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
              await sendToQueue('unread_message_email_jobs', {
                to: user.email,
                subject: 'Okunmamış Mesajlarınız Var',
                category: user.appCategory,
                type: 'unread_message',
                templateVars: {
                  name: user.name,
                  appid: user.appid,
                  unreadCount: user.unreadMessageCount
                }
              });
            }
          } catch (error) {
            console.error(`Kullanıcı için kuyruğa ekleme hatası [${user._id}]:`, error);
          }
        }

        console.log(`[${category}] İşlenen kullanıcı sayısı: ${users.length}`);
      } catch (error) {
        console.error(`Kategori işleme hatası [${category}]:`, error);
      }
    }
  } catch (error) {
    console.error('Unread message job hatası:', error);
  }
}

function startUnreadMessageJob() {
  // Her 15 dakikada bir çalış
  cron.schedule('*/15 * * * *', processUnreadMessageEmails);
  console.log('Unread message job başlatıldı');
}

module.exports = { startUnreadMessageJob };
