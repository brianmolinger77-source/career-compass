const mongoose = require('mongoose');

function nameToSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const mentorSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true },
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['mentor', 'superuser'], default: 'mentor' },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date },
  updatedAt:    { type: Date }
}, {
  timestamps: false
});

mentorSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model('Mentor', mentorSchema);
module.exports.nameToSlug = nameToSlug;
