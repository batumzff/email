const mongoose = require('mongoose');
const User = require('../models/User');
const MailPlan = require('../models/MailPlan');
const { getOptimalSendTime } = require('../utils/sendTimeAnalyzer');

const BATCH_SIZE = 1000;

async function migrateWelcomeMails() {
  console.log('Welcome mail migration başladı...');
  
  const lastDay = new Date();
  lastDay.setDate(lastDay.getDate() - 1);

  let processed = 0;
  let lastId = null;

  while (true) {
    // Son 24 saatte oluşturulmuş ve mail gönderilmemiş kullanıcıları bul
    const query = {
      createdAt: { $gte: lastDay },
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
    
    console.log(`${processed} welcome mail planlandı`);
  }

  console.log('Welcome mail migration tamamlandı');
}

async function migrateUnreadMessageMails() {
  console.log('Unread message mail migration başladı...');
  
  let processed = 0;
  let lastId = null;

  while (true) {
    // Match ve social kategorilerindeki okunmamış mesajı olan kullanıcıları bul
    const query = {
      appCategory: { $in: ['match', 'social'] },
      unreadMessageCount: { $gte: 1 }
    };

    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id email name appCategory appid unreadMessageCount')
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
    
    console.log(`${processed} unread message mail planlandı`);
  }

  console.log('Unread message mail migration tamamlandı');
}

async function migrate() {
  try {
    // MongoDB bağlantısı
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Migration başladı...');

    // Welcome mailleri migrate et
    await migrateWelcomeMails();

    // Unread message mailleri migrate et
    await migrateUnreadMessageMails();

    console.log('Migration tamamlandı!');
  } catch (error) {
    console.error('Migration hatası:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Script'i çalıştır
migrate(); 