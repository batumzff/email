const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  appCategory: { type: String, required: true },
  appid: { type: String, required: true },
  unreadMessageCount: { type: Number, default: 0 },
  createdAt: { type: Date, required: true },
  lastLoginAt: { type: Date },
  lastMailSentAt: { type: Date }
});

module.exports = mongoose.model('User', userSchema); 