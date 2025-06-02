const User = require('../models/User');
const MailPlan = require('../models/MailPlan');
const SendHourSetting = require('../models/SendHourSetting');

const BATCH_SIZE = 1000;

async function getOptimalSendTime(category) {
  try {
    // SendHourSetting'den optimal saati al
    const setting = await SendHourSetting.findOne({ category });
    
    if (!setting) {
      console.log(`[Mail Planning] ${category} kategorisi için optimal saat bulunamadı, varsayılan saat kullanılıyor`);
      // Varsayılan saatler
      const defaultHours = {
        meditation: 9,
        match: 12,
        social: 18
      };
      return defaultHours[category] || 9;
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(setting.sendHour, 0, 0, 0);
    
    return tomorrow;
  } catch (error) {
    console.error(`[Mail Planning] Optimal saat hesaplama hatası (${category}):`, error);
    // Hata durumunda varsayılan saat
    return new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(9, 0, 0, 0);
  }
}

async function planWelcomeMails() {
  console.log('[Mail Planning] Welcome mail planlaması başladı');
  
  let processed = 0;
  let lastId = null;

  while (true) {

    // Son 24 saat içinde kayıt olan kullanıcıları bul
    const query = {
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      lastMailSentAt: { $exists: false }
    };

    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id email name appCategory appid')
      .limit(BATCH_SIZE)
      .sort({ _id: 1 })
      .lean();

    if (users.length === 0) break;

    const plans = users.map(user => ({
      userId: user._id,
      email: user.email,
      mailType: 'welcome',
      plannedSendTime: getOptimalSendTime(user.appCategory),
      category: user.appCategory,
      templateVars: {
        name: user.name,
        appid: user.appid
      }
    }));

    await MailPlan.insertMany(plans);
    
    processed += users.length;
    lastId = users[users.length - 1]._id;
    
    console.log(`[Mail Planning] ${processed} welcome mail planlandı`);
  }

  console.log('[Mail Planning] Welcome mail planlaması tamamlandı');
}

async function planUnreadMessageMails() {
  console.log('[Mail Planning] Unread message mail planlaması başladı');
  
  let processed = 0;
  let lastId = null;

  while (true) {

    // Match ve social kategorilerindeki okunmamış mesajı olan kullanıcıları bul
    const query = {
      appCategory: { $in: ['match', 'social'] },
      unreadMessageCount: { $gte: 1 },
      lastUnreadMessageAt: { $exists: true }
    };

    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id email name appCategory appid unreadMessageCount lastUnreadMessageAt')
      .limit(BATCH_SIZE)
      .sort({ _id: 1 })
      .lean();

    if (users.length === 0) break;

    const plans = users.map(user => ({
      userId: user._id,
      email: user.email,
      mailType: 'unread_message',
      plannedSendTime: getOptimalSendTime(user.appCategory),
      category: user.appCategory,
      templateVars: {
        name: user.name,
        appid: user.appid,
        unreadCount: user.unreadMessageCount
      }
    }));

    await MailPlan.insertMany(plans);
    
    processed += users.length;
    lastId = users[users.length - 1]._id;
    
    console.log(`[Mail Planning] ${processed} unread message mail planlandı`);
  }

  console.log('[Mail Planning] Unread message mail planlaması tamamlandı');
}

async function planMatchMails() {
  console.log('[Mail Planning] Match mail planlaması başladı');
  
  let processed = 0;
  let lastId = null;

  while (true) {

    // Match kategorisindeki yeni eşleşmesi olan kullanıcıları bul
    const query = {
      appCategory: 'match',
      lastMatchAt: { $exists: true },
      lastMailSentAt: { $exists: false }
    };

    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id email name appCategory appid lastMatchAt')
      .limit(BATCH_SIZE)
      .sort({ _id: 1 })
      .lean();

    if (users.length === 0) break;

    const plans = users.map(user => ({
      userId: user._id,
      email: user.email,
      mailType: 'match',
      plannedSendTime: getOptimalSendTime(user.appCategory),
      category: user.appCategory,
      templateVars: {
        name: user.name,
        appid: user.appid,
        matchTime: user.lastMatchAt
      }
    }));

    await MailPlan.insertMany(plans);
    
    processed += users.length;
    lastId = users[users.length - 1]._id;
    
    console.log(`[Mail Planning] ${processed} match mail planlandı`);
  }

  console.log('[Mail Planning] Match mail planlaması tamamlandı');
}

async function planComeBackMails() {
  console.log('[Mail Planning] Come back mail planlaması başladı');
  
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  let processed = 0;
  let lastId = null;

  while (true) {

    // Son 7 gündür giriş yapmayan kullanıcıları bul
    const query = {
      lastLoginAt: { $lt: lastWeek },
      lastMailSentAt: { $exists: false }
    };

    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id email name appCategory appid lastLoginAt')
      .limit(BATCH_SIZE)
      .sort({ _id: 1 })
      .lean();

    if (users.length === 0) break;

    const plans = users.map(user => ({
      userId: user._id,
      email: user.email,
      mailType: 'come_back',
      plannedSendTime: getOptimalSendTime(user.appCategory),
      category: user.appCategory,
      templateVars: {
        name: user.name,
        appid: user.appid,
        lastLogin: user.lastLoginAt
      }
    }));

    await MailPlan.insertMany(plans);
    
    processed += users.length;
    lastId = users[users.length - 1]._id;
    
    console.log(`[Mail Planning] ${processed} come back mail planlandı`);
  }

  console.log('[Mail Planning] Come back mail planlaması tamamlandı');
}

async function planMeditationReminderMails() {
  console.log('[Mail Planning] Meditation reminder mail planlaması başladı');
  
  let processed = 0;
  let lastId = null;

  while (true) {

    // Meditation kategorisindeki kullanıcıları bul
    const query = {
      appCategory: 'meditation',
      lastMeditationAt: { $exists: true }
    };

    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id email name appCategory appid lastMeditationAt')
      .limit(BATCH_SIZE)
      .sort({ _id: 1 })
      .lean();

    if (users.length === 0) break;

    const plans = users.map(user => ({
      userId: user._id,
      email: user.email,
      mailType: 'meditation_reminder',
      plannedSendTime: getOptimalSendTime(user.appCategory),
      category: user.appCategory,
      templateVars: {
        name: user.name,
        appid: user.appid,
        lastMeditation: user.lastMeditationAt
      }
    }));

    await MailPlan.insertMany(plans);
    
    processed += users.length;
    lastId = users[users.length - 1]._id;
    
    console.log(`[Mail Planning] ${processed} meditation reminder mail planlandı`);
  }

  console.log('[Mail Planning] Meditation reminder mail planlaması tamamlandı');
}

async function planMails() {
  try {
    console.log('[Mail Planning] Mail planlama başladı');
    
    // Önceki günün başarısız maillerini tekrar planla
    const failedMails = await MailPlan.find({
      status: 'failed',
      retryCount: { $lt: 3 }
    });

    const updatePromises = failedMails.map(mail => {
      return MailPlan.updateOne(
        { _id: mail._id },
        { $set: { status: 'pending', retryCount: mail.retryCount + 1, lastError: null } }
      );
    });

    await Promise.all(updatePromises);

    console.log(`[Mail Planning] ${failedMails.length} başarısız mail tekrar planlandı`);

    // Yeni mailleri planla
    await planWelcomeMails();
    await planUnreadMessageMails();
    await planMatchMails();
    await planComeBackMails();
    await planMeditationReminderMails();

    console.log('[Mail Planning] Mail planlama tamamlandı');
  } catch (error) {
    console.error('[Mail Planning] Hata:', error);
    // TODO: Alert mekanizması eklenecek
  }
}

// Mail planlama job'u
const mailPlanningJob = {
  start: async () => {
    await planMails();
  }
};

module.exports = { mailPlanningJob }; 