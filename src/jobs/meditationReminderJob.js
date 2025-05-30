const cron = require('node-cron');
const User = require('../models/User');
const App = require('../models/App');
const MailTemplate = require('../models/MailTemplate');
const { addEmailJob } = require('../queues/emailQueue');

function startMeditationReminderJob() {
  cron.schedule('0 8 * * *', async () => {
    console.log('Meditasyon hatırlatma jobu başladı');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const users = await User.find();
    for (const user of users) {
      if (user.lastMailSentAt && user.lastMailSentAt >= today) continue;
      const app = await App.findOne({ appid: user.appid });
      if (!app || app.category !== 'meditation') continue;
      const template = await MailTemplate.findOne({ category: 'meditation', type: 'reminder' });
      if (!template) continue;
      await addEmailJob({
        to: user.email,
        category: 'meditation',
        type: 'reminder',
        subject: template.subject,
        templateVars: { username: user.email.split('@')[0] },
      }, 'meditation_email_jobs');
      user.lastMailSentAt = new Date();
      await user.save();
    }
  });
}

module.exports = { startMeditationReminderJob };
