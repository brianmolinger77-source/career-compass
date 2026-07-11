const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  route:        { type: String, required: true },
  method:       { type: String, required: true },
  errorMessage: { type: String, required: true },
  stackExcerpt: { type: String, default: '' },
  menteeId:     { type: String, default: '' },
  severity:     { type: String, enum: ['critical', 'error'], default: 'error' },
  createdAt:    { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
