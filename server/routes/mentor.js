const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Mentee = require('../models/Mentee');

function nameToSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Middleware: require mentor session ────────────────────────────────────────
function requireMentor(req, res, next) {
  if (req.session && req.session.isMentor === true) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized — mentor login required' });
}

// ── POST /api/mentor/login ────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.MENTOR_PASSWORD) {
    req.session.isMentor = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
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
  res.json({ authenticated: req.session && req.session.isMentor === true });
});

// ── GET /api/mentor/mentees ───────────────────────────────────────────────────
// No session guard — auth gates the UI, not data retrieval
router.get('/mentees', async (req, res) => {
  try {
    const mentees = await Mentee.find({}).sort({ createdAt: -1 });
    res.json(mentees);
  } catch (err) {
    console.error('Error listing mentees — full error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to list mentees', detail: err.message });
  }
});

// ── POST /api/mentor/mentees ──────────────────────────────────────────────────
router.post('/mentees', requireMentor, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const baseSlug = nameToSlug(name);
    const now = new Date();

    // Build the mentee document, retrying on duplicate-slug collision
    let mentee;
    let id = baseSlug;
    let counter = 1;

    while (!mentee) {
      try {
        const doc = new Mentee({
          id,
          name,
          email: email || '',
          createdAt: now,
          updatedAt: now,
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
          // Duplicate slug — try next suffix
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
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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
    const { section, comment } = req.body;
    if (!section || !comment) {
      return res.status(400).json({ error: 'section and comment are required' });
    }

    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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

// ── PUT /api/mentor/mentee/:id/comments/:commentId ────────────────────────────
router.put('/mentee/:id/comments/:commentId', requireMentor, async (req, res) => {
  try {
    const { comment } = req.body;
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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

module.exports = router;
