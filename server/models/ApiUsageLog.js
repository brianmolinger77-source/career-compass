const mongoose = require('mongoose');

const apiUsageLogSchema = new mongoose.Schema({
  endpoint:    { type: String, required: true },
  menteeId:    { type: String, default: '' },
  mentorId:    { type: String, default: '' },
  model:       { type: String, required: true },
  inputTokens: { type: Number, required: true },
  outputTokens:{ type: Number, required: true },
  createdAt:   { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('ApiUsageLog', apiUsageLogSchema);
