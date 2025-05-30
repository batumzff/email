require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const OpenedMail = require('./models/OpenedMail');

const app = express();
app.use(express.json());

// Sağlık kontrolü endpointi
app.get('/health', (req, res) => {
  res.send('OK');
});

// Tracking pixel endpointi
app.get('/email/opened', async (req, res) => {
  const { userId, category } = req.query;
  if (userId && category) {
    try {
      await OpenedMail.create({ userId, category, openedAt: new Date() });
    } catch (e) { /* ignore duplicate or error */ }
  }
  // 1x1 PNG
  const img = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9pQn2wAAAABJRU5ErkJggg==',
    'base64'
  );
  res.set('Content-Type', 'image/png');
  res.send(img);
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  // Tüm job'ları başlat
  require('./jobs/welcomeJob').startWelcomeJob();
  require('./jobs/comeBackJob').startComeBackJob();
  require('./jobs/matchJob').startMatchJob();
  require('./jobs/meditationReminderJob').startMeditationReminderJob();
  require('./jobs/unreadMessageJob').startUnreadMessageJob();
  require('./jobs/analyzeMeditationOpenTimesJob').startAnalyzeMeditationOpenTimesJob();
  // Email consumer başlat
  const { startEmailConsumer } = require('./queues/emailConsumer');
  startEmailConsumer('welcome_email_jobs');
  startEmailConsumer('come_back_email_jobs');
  startEmailConsumer('match_email_jobs');
  startEmailConsumer('meditation_email_jobs');
  startEmailConsumer('unread_message_email_jobs');
});
