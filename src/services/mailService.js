const nodemailer = require('nodemailer');
const pug = require('pug');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getTemplateFile(category, type) {
  if (type === 'welcome') return 'welcome_email.pug';
  if (type === 'come_back') return 'come_back_email.pug';
  if (type === 'match') return 'match_email.pug';
  if (type === 'reminder' && category === 'meditation') return 'meditation_email.pug';
  if (type === 'unread_message') return 'unread_message_email.pug';
  // Diğer senaryolar eklenebilir
  return 'default_email.pug';
}

async function sendDynamicEmail({ to, subject, category, type, templateVars }) {
  const templateFile = getTemplateFile(category, type);
  const html = pug.renderFile(
    path.join(__dirname, '../templates', templateFile),
    { subject, ...templateVars }
  );
  const mailOptions = { from: process.env.MAIL_FROM, to, subject, html };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendDynamicEmail }; 