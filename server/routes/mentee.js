const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Mentee = require('../models/Mentee');

// ── Middleware ───────────────────────────────────────────────────────────────
function requireMentor(req, res, next) {
  if (req.session && req.session.isMentor === true) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized — mentor login required' });
}
function requireMenteeOrMentor(req, res, next) {
  if (req.session && req.session.isMentor === true) return next();
  if (req.session && req.session.verifiedMenteeId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function isMenteeAuthorized(menteeId, req) {
  if (req.session && req.session.isMentor === true) return true;
  return req.session && req.session.verifiedMenteeId === menteeId;
}



// ── GET /api/mentee/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    const data = mentee.toJSON();
    if (!req.session || !req.session.isMentor) {
      delete data.mentorNotes;
    }
    res.json(data);
  } catch (err) {
    console.error('Error reading mentee:', err);
    res.status(500).json({ error: 'Failed to read mentee data' });
  }
});

// ── PUT /api/mentee/:id ───────────────────────────────────────────────────────
router.put('/:id', requireMenteeOrMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!isMenteeAuthorized(req.params.id, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Merge update — protect immutable fields
    const { id, createdAt, _id, __v, ...updates } = req.body;
    Object.assign(mentee, updates);
    mentee.updatedAt = new Date();

    // If roles were included, mark the Mixed sub-field as modified
    if (updates.roles !== undefined) mentee.markModified('roles');

    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error updating mentee:', err);
    res.status(500).json({ error: 'Failed to update mentee data' });
  }
});

// ── POST /api/mentee/:id/roles ────────────────────────────────────────────────
router.post('/:id/roles', requireMenteeOrMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!isMenteeAuthorized(req.params.id, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    mentee.roles.push({
      id: uuidv4(),
      title: '',
      organization: '',
      startYear: '',
      endYear: '',
      whatIDid: '',
      howIDidIt: '',
      impact: '',
      aiFeedback: null,
      lastAnalyzed: null
    });
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error adding role:', err);
    res.status(500).json({ error: 'Failed to add role' });
  }
});

// ── DELETE /api/mentee/:id/roles/:roleId ──────────────────────────────────────
router.delete('/:id/roles/:roleId', requireMenteeOrMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!isMenteeAuthorized(req.params.id, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    mentee.roles = mentee.roles.filter(r => r.id !== req.params.roleId);
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ── POST /api/mentee/:id/verify-pin ─────────────────────────────────────────
router.post('/:id/verify-pin', async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }
    const verified = mentee.pin === String(pin);
    if (verified) {
      req.session.verifiedMenteeId = mentee.id;
    }
    res.json({ verified });
  } catch (err) {
    console.error('Error verifying PIN:', err);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// ── POST /:id/target-roles — delete a target role ─────────────────────────────
router.delete('/:id/target-roles/:roleId', requireMenteeOrMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) return res.status(404).json({ error: 'Mentee not found' });
    if (!isMenteeAuthorized(req.params.id, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    mentee.targetRoles = (mentee.targetRoles || []).filter(r => r.id !== req.params.roleId);
    mentee.updatedAt = new Date();
    mentee.markModified('targetRoles');
    await mentee.save();

    res.json(mentee);
  } catch (err) {
    console.error('Error deleting target role:', err);
    res.status(500).json({ error: 'Failed to delete target role' });
  }
});


// ── PATCH /api/mentee/:id/mentor-notes ───────────────────────────────────────
router.patch('/:id/mentor-notes', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) return res.status(404).json({ error: 'Mentee not found' });

    mentee.mentorNotes = req.body.mentorNotes ?? '';
    mentee.updatedAt = new Date();
    await mentee.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving mentor notes:', err);
    res.status(500).json({ error: 'Failed to save mentor notes' });
  }
});

module.exports = router;
