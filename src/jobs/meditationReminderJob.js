const cron = require('node-cron');
const { sendToQueue } = require('../queues/emailQueue');
const User = require('../models/User');

async function processMeditationReminders() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentHour = new Date().getHours();

    const users = await User.find({
      appCategory: 'meditation',
      $or: [
        { lastMailSentAt: { $exists: false } },
        { lastMailSentAt: { $lt: today } }
      ],
      preferredReminderHour: currentHour
    })
    .limit(1000);

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
  } catch (error) {
    console.error('Meditation reminder job hatası:', error);
  }
}

function startMeditationReminderJob() {
  // Her saat başı çalış
  cron.schedule('0 * * * *', processMeditationReminders);
  console.log('Meditation reminder job başlatıldı');
}

module.exports = { startMeditationReminderJob };
