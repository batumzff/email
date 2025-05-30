const cron = require('node-cron');
const User = require('../models/User');
const App = require('../models/App');
const MailTemplate = require('../models/MailTemplate');
const Match = require('../models/Match');
const { addEmailJob } = require('../queues/emailQueue');

async function determineScenario(user) {
  // Hoşgeldin: Kullanıcı ilk defa giriş yapmışsa (ör: createdAt == lastLoginAt)
  if (user.createdAt && user.lastLoginAt && user.createdAt.getTime() === user.lastLoginAt.getTime()) {
    const app = await App.findOne({ appid: user.appid });
    return { category: app.category, type: 'welcome' };
  }
  // Geri dön: Kullanıcı uzun süre giriş yapmamışsa (ör: 7 gün)
  const now = new Date();
  if (user.lastLoginAt && (now - user.lastLoginAt) > 7 * 24 * 60 * 60 * 1000) {
    const app = await App.findOne({ appid: user.appid });
    return { category: app.category, type: 'come_back' };
  }
  // Eşleşme bildirimi: Kullanıcıya son 24 saatte yeni match olmuşsa
  const since = new Date(now - 24 * 60 * 60 * 1000);
  const match = await Match.findOne({
    $or: [
      { userId1: user._id },
      { userId2: user._id }
    ],
    matchedAt: { $gt: since }
  });
  if (match) {
    const app = await App.findOne({ appid: user.appid });
    return { category: app.category, type: 'match' };
  }
  // Okunmamış mesaj bildirimi: (örnek, gerçek mesaj tablosu yoksa atlanır)
  // Meditasyon hatırlatması: Uygulama kategorisi meditation ise
  const app = await App.findOne({ appid: user.appid });
  if (app && app.category === 'meditation') {
    return { category: 'meditation', type: 'reminder' };
  }
  // Diğer senaryolar eklenebilir
  return null;
}

async function getTemplate(category, type) {
  return await MailTemplate.findOne({ category, type });
}

function startDailyMailJob() {
  // Her akşam 20:00'de çalışacak şekilde ayarlanabilir
  cron.schedule('0 20 * * *', async () => {
    console.log('Günlük e-posta jobu başladı');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({ lastMailSentAt: { $lt: since } });
    for (const user of users) {
      const scenario = await determineScenario(user);
      if (!scenario) continue;
      const template = await getTemplate(scenario.category, scenario.type);
      if (!template) continue;
      await addEmailJob({
        to: user.email,
        category: scenario.category,
        type: scenario.type,
        subject: template.subject,
        templateVars: { username: user.email.split('@')[0] },
      });
      user.lastMailSentAt = new Date();
      await user.save();
    }
  });
}

module.exports = { startDailyMailJob };
