const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  appCategory: { type: String, required: true },
  appid: { type: String, required: true },
  createdAt: { type: Date, required: true },
  lastLoginAt: { type: Date },
  lastMailSentAt: { type: Date }
});

// createdAt alanına index ekle
userSchema.index({ createdAt: 1 });

module.exports = mongoose.model('User', userSchema); 