const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
  appid: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true }
});

module.exports = mongoose.model('App', appSchema); 