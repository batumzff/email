const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  appCategory: {
    type: String,
    required: true,
    enum: ['match', 'social', 'meditation', 'fitness', 'diet', 'sleep']
  },
  appid: {
    type: String,
    required: true
  },
  lastMailSentAt: {
    type: Date
  },
  unreadMessageCount: {
    type: Number,
    default: 0
  },
  lastUnreadMessageAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
userSchema.index({ createdAt: 1 });
userSchema.index({ appCategory: 1, unreadMessageCount: 1, lastUnreadMessageAt: 1 });
userSchema.index({ lastMailSentAt: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User; 