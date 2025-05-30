const cron = require('node-cron');
const User = require('../models/User');
const App = require('../models/App');
const MailTemplate = require('../models/MailTemplate');
const { addEmailJob } = require('../queues/emailQueue');

function startComeBackJob() {
  cron.schedule('0 3 * * *', async () => {
    console.log('Geri dön jobu başladı');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const users = await User.find({ lastLoginAt: { $lt: new Date(now - 7 * 24 * 60 * 60 * 1000) } });
    for (const user of users) {
      if (user.lastMailSentAt && user.lastMailSentAt >= today) continue;
      const app = await App.findOne({ appid: user.appid });
      const template = await MailTemplate.findOne({ category: app.category, type: 'come_back' });
      if (!template) continue;
      await addEmailJob({
        to: user.email,
        category: app.category,
        type: 'come_back',
        subject: template.subject,
        templateVars: { username: user.email.split('@')[0] },
      }, 'come_back_email_jobs');
      user.lastMailSentAt = new Date();
      await user.save();
    }
  });
}

module.exports = { startComeBackJob };
