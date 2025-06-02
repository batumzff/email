const mongoose = require('mongoose');

const mailPlanSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  mailType: { 
    type: String, 
    required: true,
    enum: ['welcome', 'unread_message', 'match', 'come_back', 'meditation_reminder']
  },
  plannedSendTime: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'sent', 'failed', 'permanently_failed'], 
    default: 'pending' 
  },
  category: { 
    type: String, 
    required: true,
    enum: ['match', 'social', 'meditation', 'fitness', 'diet', 'sleep']
  },
  templateVars: { 
    type: Object,
    required: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String
  },
  sentAt: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for better query performance
mailPlanSchema.index({ status: 1, plannedSendTime: 1 }); // Gönderim job'u için
mailPlanSchema.index({ userId: 1, mailType: 1, status: 1 }); // Kullanıcı bazlı sorgular için
mailPlanSchema.index({ category: 1, status: 1 }); // Kategori bazlı sorgular için
mailPlanSchema.index({ createdAt: 1 }); // Migration ve temizlik işlemleri için

const MailPlan = mongoose.model('MailPlan', mailPlanSchema);

module.exports = MailPlan; 