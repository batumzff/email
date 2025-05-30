const cron = require('node-cron');
const User = require('../models/User');
const App = require('../models/App');
const MailTemplate = require('../models/MailTemplate');
const { addEmailJob } = require('../queues/emailQueue');

function startUnreadMessageJob() {
  cron.schedule('0 * * * *', async () => {
    console.log('Okunmamış mesaj jobu başladı');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Gerçek mesaj tablosu yoksa, örnek olarak tüm kullanıcılar üzerinden dönüyoruz
    const users = await User.find();
    for (const user of users) {
      if (user.lastMailSentAt && user.lastMailSentAt >= today) continue;
      // Burada gerçek unread mesaj kontrolü yapılmalı
      // if (!hasUnreadMessages(user)) continue;
      const app = await App.findOne({ appid: user.appid });
      const template = await MailTemplate.findOne({ category: app.category, type: 'unread_message' });
      if (!template) continue;
      await addEmailJob({
        to: user.email,
        category: app.category,
        type: 'unread_message',
        subject: template.subject,
        templateVars: { username: user.email.split('@')[0] },
      }, 'unread_message_email_jobs');
      user.lastMailSentAt = new Date();
      await user.save();
    }
  });
}

module.exports = { startUnreadMessageJob };
