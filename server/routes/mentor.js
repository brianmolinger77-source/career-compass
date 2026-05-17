const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const Mentee = require('../models/Mentee');
const Mentor = require('../models/Mentor');
const mongoose = require('mongoose');

function nameToSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Middleware ────────────────────────────────────────────────────────────────

function requireMentor(req, res, next) {
  if (req.session && req.session.isMentor === true) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized — mentor login required' });
}

function requireSuperuser(req, res, next) {
  if (req.session && req.session.role === 'superuser') {
    return next();
  }
  res.status(403).json({ error: 'Forbidden — superuser access required' });
}

function canAccessMentee(mentee, session) {
  if (session.role === 'superuser') return true;
  return mentee.mentorId === session.mentorId;
}

// ── POST /api/mentor/login ────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    let connected = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await mongoose.connection.asPromise();
        connected = true;
        break;
      } catch (connErr) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (!connected) {
      return res.status(503).json({ error: 'Server is starting up, please try again in a moment.' });
    }
    const mentor = await Mentor.findOne({ email: email.toLowerCase().trim() });
    if (!mentor) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!mentor.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, mentor.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.isMentor = true;
    req.session.mentorId = mentor.id;
    req.session.role = mentor.role;

    res.json({ success: true, role: mentor.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/mentor/logout ───────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// ── GET /api/mentor/check ─────────────────────────────────────────────────────

router.get('/check', (req, res) => {
  const authenticated = req.session && req.session.isMentor === true;
  res.json({
    authenticated,
    role: authenticated ? req.session.role : null,
    mentorId: authenticated ? req.session.mentorId : null
  });
});

// ── GET /api/mentor/mentees ───────────────────────────────────────────────────

router.get('/mentees', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    let mentees;

    if (req.session.role === 'superuser') {
      const [docs, mentors] = await Promise.all([
        Mentee.find({}).sort({ createdAt: -1 }),
        Mentor.find({})
      ]);

      const mentorMap = {};
      for (const m of mentors) {
        mentorMap[m.id] = { id: m.id, name: m.name, email: m.email };
      }

      mentees = docs.map(doc => {
        const obj = doc.toJSON();
        obj.mentor = mentorMap[doc.mentorId] || null;
        return obj;
      });
    } else {
      mentees = await Mentee.find({ mentorId: req.session.mentorId }).sort({ createdAt: -1 });
    }

    res.json(mentees);
  } catch (err) {
    console.error('Error listing mentees — full error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to list mentees', detail: err.message });
  }
});

// ── POST /api/mentor/mentees ──────────────────────────────────────────────────

router.post('/mentees', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const { name, email, pin } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return res.status(400).json({ error: 'A 6-digit PIN is required' });
    }

    const baseSlug = nameToSlug(name);
    const now = new Date();

    let mentee;
    let id = baseSlug;
    let counter = 1;

    while (!mentee) {
      try {
        const doc = new Mentee({
          id,
          name,
          email: email || '',
          pin: String(pin),
          createdAt: now,
          updatedAt: now,
          mentorId: req.session.mentorId,
          roles: [],
          passions: '',
          strengths: '',
          aspirations: '',
          tableStakes: '',
          tableStakesTags: [],
          generatedNarrative: '',
          narrativeGeneratedAt: null,
          themes: [],
          themesGeneratedAt: null,
          mentorComments: []
        });
        await doc.save();
        mentee = doc;
      } catch (err) {
        if (err.code === 11000) {
          id = `${baseSlug}-${counter}`;
          counter++;
        } else {
          throw err;
        }
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({
      mentee,
      url: `${frontendUrl}/mentee/${mentee.id}`
    });
  } catch (err) {
    console.error('Error creating mentee:', err);
    res.status(500).json({ error: 'Failed to create mentee' });
  }
});

// ── GET /api/mentor/mentee/:id ────────────────────────────────────────────────

router.get('/mentee/:id', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!canAccessMentee(mentee, req.session)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(mentee);
  } catch (err) {
    console.error('Error reading mentee:', err);
    res.status(500).json({ error: 'Failed to read mentee' });
  }
});

// ── POST /api/mentor/mentee/:id/comments ─────────────────────────────────────

router.post('/mentee/:id/comments', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const { section, comment } = req.body;
    if (!section || !comment) {
      return res.status(400).json({ error: 'section and comment are required' });
    }

    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!canAccessMentee(mentee, req.session)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date();
    mentee.mentorComments.push({
      id: uuidv4(),
      section,
      comment,
      createdAt: now,
      updatedAt: now
    });
    mentee.updatedAt = now;
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ── PUT /api/mentor/mentee/:id/comments/:commentId ───────────────────────────

router.put('/mentee/:id/comments/:commentId', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const { comment } = req.body;
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!canAccessMentee(mentee, req.session)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date();
    const target = mentee.mentorComments.find(c => c.id === req.params.commentId);
    if (target) {
      target.comment = comment;
      target.updatedAt = now;
    }
    mentee.updatedAt = now;
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// ── DELETE /api/mentor/mentee/:id/comments/:commentId ────────────────────────

router.delete('/mentee/:id/comments/:commentId', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    if (!canAccessMentee(mentee, req.session)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    mentee.mentorComments = mentee.mentorComments.filter(
      c => c.id !== req.params.commentId
    );
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ── PUT /api/mentor/mentee/:id/assign — superuser only ───────────────────────

router.put('/mentee/:id/pin', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const { pin } = req.body;
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return res.status(400).json({ error: 'A 6-digit PIN is required' });
    }
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    const isSuperuser = req.session.role === 'superuser';
    const isAssigned = String(mentee.mentorId) === String(req.session.mentorId);
    if (!isSuperuser && !isAssigned) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    mentee.pin = String(pin);
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating PIN:', err);
    res.status(500).json({ error: 'Failed to update PIN' });
  }
});

router.put('/mentee/:id/assign', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const { mentorId } = req.body;
    if (!mentorId) {
      return res.status(400).json({ error: 'mentorId is required' });
    }

    const mentor = await Mentor.findOne({ id: mentorId });
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }
    if (!mentor.isActive) {
      return res.status(400).json({ error: 'Cannot assign to a deactivated mentor' });
    }

    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    mentee.mentorId = mentorId;
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json(mentee);
  } catch (err) {
    console.error('Error assigning mentee:', err);
    res.status(500).json({ error: 'Failed to assign mentee' });
  }
});

// ── GET /api/mentor/mentors — superuser only ─────────────────────────────────

router.get('/mentors', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentors = await Mentor.find({}).sort({ createdAt: -1 });
    res.json(mentors);
  } catch (err) {
    console.error('Error listing mentors:', err);
    res.status(500).json({ error: 'Failed to list mentors' });
  }
});

// ── POST /api/mentor/mentors — superuser only ────────────────────────────────

router.post('/mentors', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await Mentor.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'A mentor with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const baseSlug = nameToSlug(name);
    const now = new Date();

    let mentor;
    let id = baseSlug;
    let counter = 1;

    while (!mentor) {
      try {
        const doc = new Mentor({
          id,
          name,
          email: normalizedEmail,
          passwordHash,
          role: role || 'mentor',
          isActive: true,
          createdAt: now,
          updatedAt: now
        });
        await doc.save();
        mentor = doc;
      } catch (err) {
        if (err.code === 11000) {
          id = `${baseSlug}-${counter}`;
          counter++;
        } else {
          throw err;
        }
      }
    }

    res.json(mentor);
  } catch (err) {
    console.error('Error creating mentor:', err);
    res.status(500).json({ error: 'Failed to create mentor' });
  }
});

// ── PUT /api/mentor/mentors/:id/deactivate — superuser only ──────────────────

router.put('/mentors/:id/deactivate', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentor = await Mentor.findOne({ id: req.params.id });
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }
    mentor.isActive = false;
    mentor.updatedAt = new Date();
    await mentor.save();
    res.json(mentor);
  } catch (err) {
    console.error('Error deactivating mentor:', err);
    res.status(500).json({ error: 'Failed to deactivate mentor' });
  }
});

// ── PUT /api/mentor/mentors/:id/activate — superuser only ────────────────────

router.put('/mentors/:id/activate', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
    const mentor = await Mentor.findOne({ id: req.params.id });
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }
    mentor.isActive = true;
    mentor.updatedAt = new Date();
    await mentor.save();
    res.json(mentor);
  } catch (err) {
    console.error('Error activating mentor:', err);
    res.status(500).json({ error: 'Failed to activate mentor' });
  }
});

module.exports = router;
