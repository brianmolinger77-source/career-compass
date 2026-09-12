const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Mentee = require('../models/Mentee');
const { logError } = require('../utils/errorLog');

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

function isMenteeAuthorized(mentee, req) {
  if (!req.session) return false;
  if (req.session.isMentor === true) {
    return req.session.role === 'superuser' || mentee.mentorId === req.session.mentorId;
  }
  return req.session.verifiedMenteeId === mentee.id;
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
    delete data.pin;
    res.json(data);
  } catch (err) {
    console.error('Error reading mentee:', err);
    await logError('GET /api/mentee/:id', 'GET', err, req.params.id, 'critical');
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
    if (!isMenteeAuthorized(mentee, req)) {
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
    await logError('PUT /api/mentee/:id', 'PUT', err, req.params.id);
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
    if (!isMenteeAuthorized(mentee, req)) {
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
    await logError('POST /api/mentee/:id/roles', 'POST', err, req.params.id);
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
    if (!isMenteeAuthorized(mentee, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    mentee.roles = mentee.roles.filter(r => r.id !== req.params.roleId);
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error deleting role:', err);
    await logError('DELETE /api/mentee/:id/roles/:roleId', 'DELETE', err, req.params.id);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ── PATCH /api/mentee/:id/roles/:roleId ───────────────────────────────────────
// Atomic per-role field update. See THE-125: the old pattern (fetch the whole
// mentee, splice the patch into a JS copy of the roles array, PUT the whole
// array back) has a real race — if two roles have pending saves at once,
// whichever PUT lands last wins and silently drops the other role's edit,
// because each request's snapshot of the *other* role is stale by the time it
// writes. That's true whether the snapshot is stale by milliseconds (server
// re-fetch, THE-124's normal debounced path) or by however long a role sat
// edited-but-unsaved in another tab (the emergency-flush path this ticket
// actually reported).
//
// This route never reads-then-rewrites sibling roles at all. `arrayFilters` +
// dotted-path `$set` tells MongoDB to update only the fields on the one
// matched array element, atomically, at the database layer. Two concurrent
// PATCHes for two different roles can never collide — each only ever touches
// its own role's fields, never the array as a whole. A brand new empty role
// (POST /roles) or a role being deleted (DELETE above) are still whole-document
// operations, but those are rare, single-shot, user-initiated actions rather
// than the routine multi-field autosave/flush pattern this route replaces —
// left as-is rather than folded into this fix to keep scope to what THE-125
// actually described.
router.patch('/:id/roles/:roleId', requireMenteeOrMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!isMenteeAuthorized(mentee, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const roleExists = mentee.roles.some(r => r.id === req.params.roleId);
    if (!roleExists) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Never let a patch body overwrite the role's own id.
    const { id, ...patchFields } = req.body;
    if (Object.keys(patchFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setDoc = { updatedAt: new Date() };
    for (const [field, value] of Object.entries(patchFields)) {
      setDoc[`roles.$[role].${field}`] = value;
    }

    const updated = await Mentee.findOneAndUpdate(
      { id: req.params.id },
      { $set: setDoc },
      { arrayFilters: [{ 'role.id': req.params.roleId }], returnDocument: 'after' }
    );

    res.json(updated);
  } catch (err) {
    console.error('Error updating role:', err);
    await logError('PATCH /api/mentee/:id/roles/:roleId', 'PATCH', err, req.params.id);
    res.status(500).json({ error: 'Failed to update role' });
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
    await logError('POST /api/mentee/:id/verify-pin', 'POST', err, req.params.id, 'critical');
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// ── POST /:id/target-roles — delete a target role ─────────────────────────────
router.delete('/:id/target-roles/:roleId', requireMenteeOrMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) return res.status(404).json({ error: 'Mentee not found' });
    if (!isMenteeAuthorized(mentee, req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    mentee.targetRoles = (mentee.targetRoles || []).filter(r => r.id !== req.params.roleId);
    mentee.updatedAt = new Date();
    mentee.markModified('targetRoles');
    await mentee.save();

    res.json(mentee);
  } catch (err) {
    console.error('Error deleting target role:', err);
    await logError('DELETE /api/mentee/:id/target-roles/:roleId', 'DELETE', err, req.params.id);
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
    await logError('PATCH /api/mentee/:id/mentor-notes', 'PATCH', err, req.params.id);
    res.status(500).json({ error: 'Failed to save mentor notes' });
  }
});

module.exports = router;
