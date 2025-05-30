const cron = require('node-cron');
const SendHourSetting = require('../models/SendHourSetting');
const User = require('../models/User');

async function analyzeMeditationOpenTimes() {
  try {
    // Son 30 günlük verileri analiz et
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Her saat için açılma oranlarını hesapla
    const openRates = await User.aggregate([
      {
        $match: {
          appCategory: 'meditation',
          lastMailSentAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $hour: '$lastMailSentAt' },
          total: { $sum: 1 },
          opened: { $sum: { $cond: [{ $eq: ['$lastMailOpenedAt', true] }, 1, 0] } }
        }
      },
      {
        $project: {
          hour: '$_id',
          openRate: { $divide: ['$opened', '$total'] }
        }
      },
      {
        $sort: { openRate: -1 }
      }
    ]);

    // En yüksek açılma oranına sahip saati bul
    const optimalHour = openRates[0]?.hour || 9;

    // Optimal saati güncelle
    await SendHourSetting.findOneAndUpdate(
      { category: 'meditation' },
      { 
        category: 'meditation',
        sendHour: optimalHour,
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    console.log(`[02:00] Optimal mail gönderme saati güncellendi: ${optimalHour}:00`);
  } catch (error) {
    console.error('Meditation open times analiz hatası:', error);
  }
}

function startAnalyzeMeditationOpenTimesJob() {
  // Her gece saat 2'de çalış
  cron.schedule('0 2 * * *', analyzeMeditationOpenTimes);
  console.log('Meditation open times analiz job başlatıldı');
}

module.exports = { startAnalyzeMeditationOpenTimesJob }; 