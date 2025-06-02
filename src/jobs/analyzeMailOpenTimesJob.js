const cron = require('node-cron');
const SendHourSetting = require('../models/SendHourSetting');
const User = require('../models/User');
const OpenedMail = require('../models/OpenedMail');
const { mailPlanningJob } = require('./mailPlanningJob');

async function analyzeOpenTimes() {
  try {
    console.log('[Analyze] Mail açma zamanları analizi başladı');
    
    // Her kategori için analiz yap
    const categories = ['meditation', 'match', 'social'];
    for (const category of categories) {
      await analyzeCategory(category);
    }
    
    console.log('[Analyze] Mail açma zamanları analizi tamamlandı');

    // Analiz tamamlandıktan sonra planlama job'unu başlat
    console.log('[Analyze] Mail planlama job\'u başlatılıyor...');
    await mailPlanningJob.start();
  } catch (error) {
    console.error('[Analyze] Hata:', error);
    // TODO: Alert mekanizması eklenecek
  }
}

async function analyzeCategory(category) {
  try {
    const openTimes = await OpenedMail.find({ category })
      .select('openedAt')
      .lean();

    const hourlyDistribution = new Array(24).fill(0);
    openTimes.forEach(mail => {
      const hour = mail.openedAt.getHours();
      hourlyDistribution[hour]++;
    });

    // En yüksek açılma oranına sahip saati bul
    const optimalHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));

    // Optimal saati güncelle
    await SendHourSetting.findOneAndUpdate(
      { category },
      { 
        category,
        sendHour: optimalHour,
        lastUpdated: new Date()
      },
      { upsert: true }
    );

    console.log(`[Analyze] ${category} kategorisi için optimal saat: ${optimalHour}:00`);
  } catch (error) {
    console.error(`[Analyze] ${category} kategorisi analiz hatası:`, error);
    throw error; // Üst fonksiyona hatayı ilet
  }
}

function startAnalyzeOpenTimesJob() {
  // Her gece saat 23'te çalış
  cron.schedule('0 23 * * *', analyzeOpenTimes);
  console.log('Open times analiz job başlatıldı');
}

module.exports = { analyzeMailOpenTimesJob: { start: startAnalyzeOpenTimesJob } }; 