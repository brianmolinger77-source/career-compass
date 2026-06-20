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

const jobAnalysisSchema = new mongoose.Schema({
  id:             { type: String },
  jobTitle:       { type: String, default: '' },
  jobPostingText: { type: String, default: '' },
  analyzedAt:     { type: Date },
  aligns:         { type: [mongoose.Schema.Types.Mixed], default: [] },
  differences:    { type: [String], default: [] },
  unknowns:       { type: [String], default: [] },
  conflicts:      { type: mongoose.Schema.Types.Mixed, default: [] },
  mentorFlagged:  { type: Boolean, default: true }
}, { _id: false });

const targetRoleSchema = new mongoose.Schema({
  id:                { type: String },
  jobTitle:          { type: String, default: '' },
  companyOrIndustry: { type: String, default: '' },
  aligns:            { type: [mongoose.Schema.Types.Mixed], default: [] },
  differences:       { type: [String], default: [] },
  unknowns:          { type: [String], default: [] },
  conflicts:         { type: mongoose.Schema.Types.Mixed, default: [] },
  analyzedAt:        { type: Date }
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const menteeSchema = new mongoose.Schema({
  id:                   { type: String, required: true, unique: true },
  name:                 { type: String, required: true },
  email:                { type: String, default: '' },
  militaryBranch:      { type: String, default: '' },
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
  psaAnalysis:          { type: mongoose.Schema.Types.Mixed, default: null },
  resumeBullets:        { type: mongoose.Schema.Types.Mixed, default: null },
  resumeGeneratedAt:    { type: Date, default: null },
  resumeSkills:         { type: [String], default: [] },
  resumeCertifications: { type: [String], default: [] },
  resumeEducation:      { type: [String], default: [] },
  resumeSummary:        { type: String, default: '' },
  savedJobPostingText: { type: String, default: '' },
  pin:                  { type: String, default: '' },
  jobAnalyses:          { type: [jobAnalysisSchema], default: [] },
  targetRoles:          { type: [targetRoleSchema], default: [] },
  targetRolePattern:    { type: String, default: '' },
  mentorId:             { type: String, default: '' },
  sessionPrepInput:     { type: String, default: '' },
  sessionPrepAgenda:    { type: mongoose.Schema.Types.Mixed, default: null },
  sessionPrepNotes:     { type: String, default: '' }
}, {
  timestamps: false
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
