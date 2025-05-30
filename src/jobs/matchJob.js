const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');
const Match = require('../models/Match');

async function processMatchEmails() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Toplam işlenecek eşleşme sayısını hesapla
    const totalMatches = await Match.countDocuments({
      matchedAt: { $gte: today },
      emailSent: false
    });

    // Her çalışmada işlenecek eşleşme sayısını hesapla
    // 5 dakikada bir çalıştığı için günde 288 çalışma olacak
    const batchSize = Math.ceil(totalMatches / 288);

    const matches = await Match.find({
      matchedAt: { $gte: today },
      emailSent: false
    })
    .sort({ matchedAt: 1 }) // En eski eşleşmeler önce
    .limit(batchSize);

    // Eşleşmeleri işle
    for (const match of matches) {
      try {
        // Her iki kullanıcıyı da bul
        const [user1, user2] = await Promise.all([
          User.findById(match.userId1),
          User.findById(match.userId2)
        ]);

        if (!user1 || !user2) continue;

        // Her iki kullanıcıya da e-posta gönder
        await Promise.all([
          sendToQueue('match_email_jobs', {
            to: user1.email,
            subject: 'Yeni Eşleşmeniz Var!',
            category: user1.appCategory,
            type: 'match',
            templateVars: {
              name: user1.name,
              matchName: user2.name,
              appName: user1.appName
            }
          }),
          sendToQueue('match_email_jobs', {
            to: user2.email,
            subject: 'Yeni Eşleşmeniz Var!',
            category: user2.appCategory,
            type: 'match',
            templateVars: {
              name: user2.name,
              matchName: user1.name,
              appName: user2.appName
            }
          })
        ]);

        // Eşleşmeyi güncelle
        match.emailSent = true;
        await match.save();

        // Kullanıcıların lastMailSentAt alanlarını güncelle
        await Promise.all([
          User.updateOne(
            { _id: user1._id },
            { $set: { lastMailSentAt: new Date() } }
          ),
          User.updateOne(
            { _id: user2._id },
            { $set: { lastMailSentAt: new Date() } }
          )
        ]);

      } catch (error) {
        console.error(`Eşleşme için kuyruğa ekleme hatası [${match._id}]:`, error);
      }
    }

    console.log(`İşlenen eşleşme sayısı: ${matches.length}`);
  } catch (error) {
    console.error('Match job hatası:', error);
  }
}

function startMatchJob() {
  // Her 5 dakikada bir çalış
  cron.schedule('*/5 * * * *', processMatchEmails);
  console.log('Match job başlatıldı');
}

module.exports = { startMatchJob };
