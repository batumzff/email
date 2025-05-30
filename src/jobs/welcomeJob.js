const cron = require('node-cron');
const User = require('../models/User');
const App = require('../models/App');
const MailTemplate = require('../models/MailTemplate');
const { addEmailJob } = require('../queues/emailQueue');

function startWelcomeJob() {
  cron.schedule('*/10 * * * *', async () => {
    console.log('Hoşgeldin jobu başladı');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const users = await User.find({ $expr: { $eq: ["$createdAt", "$lastLoginAt"] } });
    for (const user of users) {
      if (user.lastMailSentAt && user.lastMailSentAt >= today) continue;
      const app = await App.findOne({ appid: user.appid });
      const template = await MailTemplate.findOne({ category: app.category, type: 'welcome' });
      if (!template) continue;
      await addEmailJob({
        to: user.email,
        category: app.category,
        type: 'welcome',
        subject: template.subject,
        templateVars: { username: user.email.split('@')[0] },
      }, 'welcome_email_jobs');
      user.lastMailSentAt = new Date();
      await user.save();
    }
  });
}

module.exports = { startWelcomeJob };
