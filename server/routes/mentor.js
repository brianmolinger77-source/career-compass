const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const Mentee = require('../models/Mentee');
const Mentor = require('../models/Mentor');
const mongoose = require('mongoose');
const ApiUsageLog = require('../models/ApiUsageLog');
const ErrorLog = require('../models/ErrorLog');
const { logError } = require('../utils/errorLog');
const crypto = require('crypto');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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

const LOGIN_MAX_TRIES = 5
const LOGIN_LOCK_MINUTES = [15, 60, 1440]

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
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
    const cleanEmail = email.toLowerCase().trim();

    // Count this attempt in the database BEFORE comparing the password, in one atomic step,
    // and only for an active account that is not locked. Parallel guesses cannot all pass.
    const now = new Date();
    const counted = await Mentor.findOneAndUpdate(
      { email: cleanEmail, isActive: true, $or: [{ loginLockedUntil: null }, { loginLockedUntil: { $lte: now } }] },
      { $inc: { loginFailedAttempts: 1 } },
      { returnDocument: 'after' }
    ).select('+loginFailedAttempts +loginLockLevel');

    if (!counted) {
      const existing = await Mentor.findOne({ email: cleanEmail }).select('+loginLockedUntil');
      if (!existing) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!existing.isActive) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }
      const msLeft = existing.loginLockedUntil ? existing.loginLockedUntil.getTime() - now.getTime() : 0;
      return res.status(429).json({ error: 'locked', locked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / 60000)) });
    }

    const level = Math.min(counted.loginLockLevel || 0, LOGIN_LOCK_MINUTES.length - 1);
    const attempts = counted.loginFailedAttempts;

    // Over the limit (parallel guesses that slipped in before the lock was set): refuse without comparing.
    if (attempts > LOGIN_MAX_TRIES) {
      return res.status(429).json({ error: 'locked', locked: true, minutesLeft: LOGIN_LOCK_MINUTES[level] });
    }

    const valid = await bcrypt.compare(password, counted.passwordHash);
    if (valid) {
      await Mentor.updateOne({ id: counted.id }, { $set: { loginFailedAttempts: 0, loginLockLevel: 0, loginLockedUntil: null } });
      req.session.isMentor = true;
      req.session.mentorId = counted.id;
      req.session.role = counted.role;
      return res.json({ success: true, role: counted.role });
    }

    if (attempts >= LOGIN_MAX_TRIES) {
      const minutes = LOGIN_LOCK_MINUTES[level];
      await Mentor.updateOne(
        { id: counted.id },
        { $set: { loginLockedUntil: new Date(Date.now() + minutes * 60000), loginFailedAttempts: 0 }, $inc: { loginLockLevel: 1 } }
      );
      return res.status(429).json({ error: 'locked', locked: true, minutesLeft: minutes });
    }

    return res.status(401).json({ error: 'Invalid email or password' });
  } catch (err) {
    console.error('Login error:', err);
    await logError('POST /api/mentor/login', 'POST', err, null, 'critical');
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    await mongoose.connection.asPromise();

    const { email } = req.body;
    const genericResponse = { message: 'If that email is associated with a mentor account, a reset link has been sent.' };

    if (!email) {
      return res.json(genericResponse);
    }

    const mentor = await Mentor.findOne({ email: email.toLowerCase().trim() });

    if (mentor && mentor.isActive) {
      const now = new Date();
      const cooldownActive = mentor.resetPasswordExpiresAt && mentor.resetPasswordExpiresAt > now;

      if (!cooldownActive) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        mentor.resetPasswordTokenHash = tokenHash;
        mentor.resetPasswordExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);
        await mentor.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/mentor/reset-password?token=${rawToken}`;

        try {
          await resend.emails.send({
            from: 'Career Compass <noreply@milcareercompass.com>',
            to: mentor.email,
            subject: 'Reset your Career Compass password',
            text: `Hi,\n\nWe got a request to reset your Career Compass mentor password. Click the link below to set a new one.\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't ask for this, you can ignore this email. Your password will stay the same.\n\n— Career Compass`
          });
        } catch (emailErr) {
          console.error('Error sending password reset email:', emailErr);
          await logError('POST /api/mentor/forgot-password', 'POST', emailErr, null, 'error');
        }
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Error in forgot-password:', err);
    await logError('POST /api/mentor/forgot-password', 'POST', err, null, 'critical');
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    await mongoose.connection.asPromise();

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const mentor = await Mentor.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: now }
    });

    if (!mentor) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    mentor.passwordHash = passwordHash;
    mentor.loginFailedAttempts = 0;
    mentor.loginLockLevel = 0;
    mentor.loginLockedUntil = null;
    mentor.resetPasswordTokenHash = null;
    mentor.resetPasswordExpiresAt = null;
    mentor.updatedAt = now;
    await mentor.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error in reset-password:', err);
    await logError('POST /api/mentor/reset-password', 'POST', err, null, 'critical');
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
        Mentee.find({}).select('+pin +mentorNotes').sort({ createdAt: -1 }),
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
      mentees = await Mentee.find({ mentorId: req.session.mentorId }).select('+pin +mentorNotes').sort({ createdAt: -1 });
    }

    res.json(mentees);
  } catch (err) {
    console.error('Error listing mentees — full error:', err.message, err.stack);
    await logError('GET /api/mentor/mentees', 'GET', err, null, 'critical');
    res.status(500).json({ error: 'Failed to list mentees', detail: err.message });
  }
});

// ── POST /api/mentor/mentees ──────────────────────────────────────────────────

router.post('/mentees', requireMentor, async (req, res) => {
  try {
    await mongoose.connection.asPromise();
      const { name, email, pin, militaryBranch } = req.body;
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
            militaryBranch: militaryBranch || '',
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
    await logError('POST /api/mentor/mentees', 'POST', err);
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
    await logError('GET /api/mentor/mentee/:id', 'GET', err, req.params.id);
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
    await logError('POST /api/mentor/mentee/:id/comments', 'POST', err, req.params.id);
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
    await logError('PUT /api/mentor/mentee/:id/comments/:commentId', 'PUT', err, req.params.id);
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
    await logError('DELETE /api/mentor/mentee/:id/comments/:commentId', 'DELETE', err, req.params.id);
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
    if (!canAccessMentee(mentee, req.session)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    mentee.pin = String(pin);
    mentee.pinFailedAttempts = 0;
    mentee.pinLockLevel = 0;
    mentee.pinLockedUntil = null;
    mentee.updatedAt = new Date();
    await mentee.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating PIN:', err);
    await logError('PUT /api/mentor/mentee/:id/pin', 'PUT', err, req.params.id, 'critical');
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
    await logError('PUT /api/mentor/mentee/:id/assign', 'PUT', err, req.params.id);
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
    await logError('GET /api/mentor/mentors', 'GET', err);
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
    await logError('POST /api/mentor/mentors', 'POST', err);
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
    await logError('PUT /api/mentor/mentors/:id/deactivate', 'PUT', err);
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
    await logError('PUT /api/mentor/mentors/:id/activate', 'PUT', err);
    res.status(500).json({ error: 'Failed to activate mentor' });
  }
});


// ── GET /api/mentor/usage — superuser only ───────────────────────────────────

router.get('/usage', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();

    const logs = await ApiUsageLog.find({}).lean();

    // Aggregate by endpoint
    const byEndpoint = {};
    let totalInput = 0;
    let totalOutput = 0;
    const menteesSeen = new Set();

    for (const log of logs) {
      if (!byEndpoint[log.endpoint]) {
        byEndpoint[log.endpoint] = { calls: 0, inputTokens: 0, outputTokens: 0 };
      }
      byEndpoint[log.endpoint].calls += 1;
      byEndpoint[log.endpoint].inputTokens += log.inputTokens;
      byEndpoint[log.endpoint].outputTokens += log.outputTokens;
      totalInput += log.inputTokens;
      totalOutput += log.outputTokens;
      if (log.menteeId) menteesSeen.add(log.menteeId);
    }

    res.json({
      totalCalls: logs.length,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      distinctMentees: menteesSeen.size,
      byEndpoint,
      loggingStartDate: '2026-05-25'
    });
  } catch (err) {
    console.error('Error fetching usage data:', err);
    await logError('GET /api/mentor/usage', 'GET', err);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// ── GET /api/mentor/errors — superuser only ──────────────────────────────────

router.get('/errors', requireMentor, requireSuperuser, async (req, res) => {
  try {
    await mongoose.connection.asPromise();

    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    limit = Math.min(limit, 200);

    const routeFilter = req.query.route ? { route: req.query.route } : {};
    const queryFilter = { ...routeFilter };
    if (req.query.severity) queryFilter.severity = req.query.severity;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [total, lastHour, last24h, critical, errors, criticalGroupsRaw] = await Promise.all([
      ErrorLog.countDocuments(queryFilter),
      ErrorLog.countDocuments({ ...queryFilter, createdAt: { $gte: oneHourAgo } }),
      ErrorLog.countDocuments({ ...queryFilter, createdAt: { $gte: oneDayAgo } }),
      ErrorLog.countDocuments({ ...routeFilter, severity: 'critical' }),
      ErrorLog.find(queryFilter).sort({ createdAt: -1 }).limit(limit).lean(),
      ErrorLog.aggregate([
        { $match: { ...routeFilter, severity: 'critical' } },
        {
          $group: {
            _id: { route: '$route', errorMessage: '$errorMessage' },
            count: { $sum: 1 },
            distinctMentees: { $addToSet: '$menteeId' },
            firstAt: { $min: '$createdAt' },
            mostRecentAt: { $max: '$createdAt' }
          }
        },
        { $sort: { mostRecentAt: -1 } }
      ])
    ]);

    res.json({
      summary: { total, lastHour, last24h, critical },
      criticalGroups: criticalGroupsRaw.map(g => ({
        route: g._id.route,
        errorMessage: g._id.errorMessage,
        count: g.count,
        distinctMenteeCount: g.distinctMentees.filter(Boolean).length,
        firstAt: g.firstAt,
        mostRecentAt: g.mostRecentAt
      })),
      errors: errors.map(e => ({
        route: e.route,
        method: e.method,
        errorMessage: e.errorMessage,
        stackExcerpt: e.stackExcerpt,
        menteeId: e.menteeId,
        severity: e.severity,
        createdAt: e.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching error logs:', err);
    await logError('GET /api/mentor/errors', 'GET', err);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

module.exports = router;
