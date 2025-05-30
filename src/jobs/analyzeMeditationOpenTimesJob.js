const cron = require('node-cron');
const OpenedMail = require('../models/OpenedMail');
const SendHourSetting = require('../models/SendHourSetting');

function startAnalyzeMeditationOpenTimesJob() {
  // Her gün saat 02:00'de çalışır
  cron.schedule('0 2 * * *', async () => {
    console.log('Meditation open times analysis job started');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Son 30 gün
    const opens = await OpenedMail.find({ category: 'meditation', openedAt: { $gte: since } });
    const hours = Array(24).fill(0);
    opens.forEach(open => {
      const hour = new Date(open.openedAt).getHours();
      hours[hour]++;
    });
    const maxHour = hours.indexOf(Math.max(...hours));
    if (maxHour >= 0) {
      await SendHourSetting.updateOne(
        { category: 'meditation' },
        { $set: { sendHour: maxHour } },
        { upsert: true }
      );
      console.log(`[Meditation] En çok okunan saat: ${maxHour}:00`);
    }
  });
}

module.exports = { startAnalyzeMeditationOpenTimesJob }; 