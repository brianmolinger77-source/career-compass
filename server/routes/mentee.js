const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Mentee = require('../models/Mentee');

// ── GET /api/mentee/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    res.json(mentee);
  } catch (err) {
    console.error('Error reading mentee:', err);
    res.status(500).json({ error: 'Failed to read mentee data' });
  }
});

// ── PUT /api/mentee/:id ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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
router.post('/:id/roles', async (req, res) => {
  try {
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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
router.delete('/:id/roles/:roleId', async (req, res) => {
  try {
    const mentee = await Mentee.findOne({ id: req.params.id });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
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

module.exports = router;
