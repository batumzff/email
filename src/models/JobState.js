const mongoose = require('mongoose');

const jobStateSchema = new mongoose.Schema({
  jobName: { 
    type: String, 
    required: true,
    unique: true 
  },
  lastProcessedTime: { 
    type: Date, 
    required: true 
  },
  isProcessing: {
    type: Boolean,
    default: false
  },
  lastError: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('JobState', jobStateSchema); 