const mongoose = require('mongoose');

const sendHourSettingSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  sendHour: { type: Number, required: true }
});

module.exports = mongoose.model('SendHourSetting', sendHourSettingSchema); 