const mongoose = require('mongoose');

const openedMailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  category: { type: String, required: true },
  openedAt: { type: Date, required: true }
});

module.exports = mongoose.model('OpenedMail', openedMailSchema); 