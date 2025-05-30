const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

async function processComeBackEmails() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Tüm kategorileri al
    const categories = await User.distinct('appCategory');
    
    // Her kategori için ayrı işlem yap
    for (const category of categories) {
      try {
        // Bu kategori için toplam işlenecek kullanıcı sayısını hesapla
        const totalUsersInCategory = await User.countDocuments({
          appCategory: category,
          lastLoginAt: { $lt: thirtyDaysAgo },
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
          lastLoginAt: { $lt: thirtyDaysAgo },
          $or: [
            { lastMailSentAt: { $exists: false } },
            { lastMailSentAt: { $lt: today } }
          ]
        })
        .sort({ lastLoginAt: 1 }) // En eski giriş yapmayanlar önce
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
              await sendToQueue('come_back_email_jobs', {
                to: user.email,
                subject: 'Sizi Özledik!',
                category: user.appCategory,
                type: 'come_back',
                templateVars: {
                  name: user.name,
                  appName: user.appName,
                  daysSinceLastLogin: 30
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
    console.error('Come back job hatası:', error);
  }
}

function startComeBackJob() {
  // Her 15 dakikada bir çalış
  cron.schedule('*/15 * * * *', processComeBackEmails);
  console.log('Come back job başlatıldı');
}

module.exports = { startComeBackJob };
