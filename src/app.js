require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const app = express();
app.use(express.json());

// Sağlık kontrolü endpointi
app.get('/health', (req, res) => {
  res.send('OK');
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
  // Email consumer başlat
  const { startEmailConsumer } = require('./queues/emailConsumer');
  startEmailConsumer('welcome_email_jobs');
  startEmailConsumer('come_back_email_jobs');
  startEmailConsumer('match_email_jobs');
  startEmailConsumer('meditation_email_jobs');
  startEmailConsumer('unread_message_email_jobs');
});
