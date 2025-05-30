const cron = require('node-cron');
const User = require('../models/User');
const App = require('../models/App');
const MailTemplate = require('../models/MailTemplate');
const Match = require('../models/Match');
const { addEmailJob } = require('../queues/emailQueue');

function startMatchJob() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Match jobu başladı');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const users = await User.find();
    for (const user of users) {
      if (user.lastMailSentAt && user.lastMailSentAt >= today) continue;
      const match = await Match.findOne({
        $or: [
          { userId1: user._id },
          { userId2: user._id }
        ],
        matchedAt: { $gt: since }
      });
      if (!match) continue;
      const app = await App.findOne({ appid: user.appid });
      const template = await MailTemplate.findOne({ category: app.category, type: 'match' });
      if (!template) continue;
      await addEmailJob({
        to: user.email,
        category: app.category,
        type: 'match',
        subject: template.subject,
        templateVars: { username: user.email.split('@')[0] },
      }, 'match_email_jobs');
      user.lastMailSentAt = new Date();
      await user.save();
    }
  });
}

module.exports = { startMatchJob };
