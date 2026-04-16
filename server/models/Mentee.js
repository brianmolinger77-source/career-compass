const mongoose = require('mongoose');

// ── Sub-schemas (no auto _id on nested docs) ─────────────────────────────────

const roleSchema = new mongoose.Schema({
  id:                   { type: String },
  title:                { type: String, default: '' },
  organization:         { type: String, default: '' },
  startYear:            { type: String, default: '' },
  endYear:              { type: String, default: '' },
  whatIDid:             { type: String, default: '' },
  howIDidIt:            { type: String, default: '' },
  impact:               { type: String, default: '' },
  aiFeedback:           { type: mongoose.Schema.Types.Mixed, default: null },
  lastAnalyzed:         { type: Date, default: null },
  revisedAfterFeedback: { type: Boolean, default: false }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  id:        { type: String },
  section:   { type: String },
  comment:   { type: String },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const menteeSchema = new mongoose.Schema({
  id:                   { type: String, required: true, unique: true },
  name:                 { type: String, required: true },
  email:                { type: String, default: '' },
  createdAt:            { type: Date },
  updatedAt:            { type: Date },
  roles:                { type: [roleSchema], default: [] },
  passions:             { type: String, default: '' },
  strengths:            { type: String, default: '' },
  aspirations:          { type: String, default: '' },
  tableStakes:          { type: String, default: '' },
  tableStakesTags:      { type: [String], default: [] },
  generatedNarrative:   { type: String, default: '' },
  narrativeGeneratedAt: { type: Date, default: null },
  themes:               { type: [String], default: [] },
  themesGeneratedAt:    { type: Date, default: null },
  mentorComments:       { type: [commentSchema], default: [] },
  careerThread:         { type: String, default: '' },
  psaAnalysis:          { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  timestamps: false   // managed manually to stay consistent with existing ISO strings
});

// Remove Mongoose internals (_id, __v) from JSON output
menteeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Mentee', menteeSchema);
