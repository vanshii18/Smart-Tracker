const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  status: { type: String, default: 'Applied' },
  dateApplied: String,
  followUpDate: String,
});

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
