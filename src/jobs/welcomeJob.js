const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

async function processWelcomeEmails() {
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
          isWelcomeEmailSent: false,
          createdAt: { $lt: today }
        });

        // Her çalışmada işlenecek kullanıcı sayısını hesapla
        // 15 dakikada bir çalıştığı için günde 96 çalışma olacak
        const batchSize = Math.ceil(totalUsersInCategory / 96);

        const users = await User.find({
          appCategory: category,
          isWelcomeEmailSent: false,
          createdAt: { $lt: today }
        })
        .sort({ createdAt: 1 }) // En eski kayıtlar önce
        .limit(batchSize);

        // Bu kategorideki kullanıcıları işle
        for (const user of users) {
          try {
            const updated = await User.updateOne(
              { 
                _id: user._id,
                isWelcomeEmailSent: false
              },
              { $set: { isWelcomeEmailSent: true } }
            );
            if (updated.nModified === 1 || updated.modifiedCount === 1) {
              await sendToQueue('welcome_email_jobs', {
                to: user.email,
                subject: 'Hoş Geldiniz!',
                category: user.appCategory,
                type: 'welcome',
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

        console.log(`[${category}] İşlenen kullanıcı sayısı: ${users.length}`);
      } catch (error) {
        console.error(`Kategori işleme hatası [${category}]:`, error);
      }
    }
  } catch (error) {
    console.error('Welcome job hatası:', error);
  }
}

function startWelcomeJob() {
  // Her 15 dakikada bir çalış
  cron.schedule('*/15 * * * *', processWelcomeEmails);
  console.log('Welcome job başlatıldı');
}

module.exports = { startWelcomeJob };
