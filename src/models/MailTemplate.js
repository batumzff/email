const mongoose = require('mongoose');

const mailTemplateSchema = new mongoose.Schema({
  category: { type: String, required: true },
  type: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true }
});

module.exports = mongoose.model('MailTemplate', mailTemplateSchema); 