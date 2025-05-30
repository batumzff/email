const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  userId1: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId2: { type: mongoose.Schema.Types.ObjectId, required: true },
  matchedAt: { type: Date, required: true }
});

module.exports = mongoose.model('Match', matchSchema); 