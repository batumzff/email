const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  appid: { type: String, required: true },
  createdAt: { type: Date, required: true },
  lastLoginAt: { type: Date },
  lastMailSentAt: { type: Date }
});

module.exports = mongoose.model('User', userSchema); 