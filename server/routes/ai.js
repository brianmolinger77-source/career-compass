const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const Mentee = require('../models/Mentee');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = 'claude-sonnet-4-20250514';

// ── POST /api/analyze-role ────────────────────────────────────────────────────
router.post('/analyze-role', async (req, res) => {
  try {
    const { menteeId, roleId, whatIDid, howIDidIt, impact } = req.body;

    if (!menteeId || !roleId) {
      return res.status(400).json({ error: 'menteeId and roleId are required' });
    }

    const mentee = await Mentee.findOne({ id: menteeId });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    const systemPrompt = `You are an expert career coach helping military veterans translate their service experience into compelling civilian career language. You are reviewing a role entry from a veteran's career pathing document.

Your job is to identify three types of issues and provide specific, actionable feedback:

1. JARGON & MILITARY LANGUAGE: Flag any military-specific terms, acronyms, rank structures, unit designations, or insider language that a civilian hiring manager would not understand. For each item flagged, explain in plain English why it is opaque to civilians and what concept it represents.

2. MISSING "HOW": If the entry focuses only on what they did (tasks and duties) without explaining how they approached the work — how they prioritized, managed relationships, led people, or solved problems — flag this gap. Give 2-3 specific prompting questions to help them add this dimension.

3. MISSING IMPACT: If the entry does not articulate what changed or improved because of their work — money saved, risk reduced, efficiency gained, people developed — flag this gap. Encourage the use of specific numbers, percentages, or scale wherever possible.

Return your response as JSON in this exact format:
{
  "jargonFlags": [
    {
      "term": "the flagged term or phrase",
      "explanation": "why this is opaque to civilians",
      "suggestion": "a civilian-friendly alternative or explanation"
    }
  ],
  "missingHow": {
    "detected": true or false,
    "feedback": "specific feedback if detected",
    "promptingQuestions": ["question 1", "question 2"]
  },
  "missingImpact": {
    "detected": true or false,
    "feedback": "specific feedback if detected",
    "promptingQuestions": ["question 1", "question 2"]
  },
  "overallStrength": "1-2 sentences on what is working well in this entry. IMPORTANT: Only populate this field if the entry genuinely meets ALL THREE of these criteria: (1) it is clearly understandable to a civilian with no military knowledge, (2) it communicates concrete impact or outcomes rather than just listing tasks, and (3) it contains no unexplained military jargon or acronyms. If the entry does not meet all three criteria, return null. Do not offer encouragement as a substitute for genuine quality.",
  "priorityAction": "The single most important thing they should do to improve this entry"
}`;

    const userMessage = `Please analyze this role entry from a military veteran's career document:

**What I Did:**
${whatIDid || '(not provided)'}

**How I Did It:**
${howIDidIt || '(not provided)'}

**The Impact:**
${impact || '(not provided)'}

Provide specific, actionable feedback to help translate this into compelling civilian career language.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    const rawText = response.content[0].text;

    let feedback;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr);
      return res.status(500).json({
        error: 'Analysis unavailable right now — try again in a moment. Your content has been saved.'
      });
    }

    // Persist feedback onto the matching role
    const now = new Date();
    const role = mentee.roles.find(r => r.id === roleId);
    if (role) {
      const wasReanalysis = !!role.lastAnalyzed && req.body.isRevision === true;
      if (whatIDid !== undefined) role.whatIDid = whatIDid;
      if (howIDidIt !== undefined) role.howIDidIt = howIDidIt;
      if (impact !== undefined) role.impact = impact;
      role.aiFeedback = feedback;
      role.lastAnalyzed = now;
      role.revisedAfterFeedback = wasReanalysis;
    }
    mentee.updatedAt = now;
    mentee.markModified('roles');   // required: roles contains a Mixed field (aiFeedback)
    await mentee.save();

    res.json({ feedback, mentee });
  } catch (err) {
    console.error('Error analyzing role:', err);
    res.status(500).json({
      error: 'Analysis unavailable right now — try again in a moment. Your content has been saved.'
    });
  }
});

// ── POST /api/generate-narrative ─────────────────────────────────────────────
router.post('/generate-narrative', async (req, res) => {
  try {
    const { menteeId, careerThread: careerThreadFromRequest } = req.body;

    if (!menteeId) {
      return res.status(400).json({ error: 'menteeId is required' });
    }

    const mentee = await Mentee.findOne({ id: menteeId });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    // Use request-supplied careerThread if provided, otherwise use saved value
    if (careerThreadFromRequest !== undefined) {
      mentee.careerThread = careerThreadFromRequest;
    }

    const rolesText = (mentee.roles || []).map((role, i) => {
      return `Role ${i + 1}: ${role.title || 'Untitled'} at ${role.organization || 'Unknown Organization'} (${role.startYear || '?'} - ${role.endYear || 'Present'})
What I Did: ${role.whatIDid || 'Not provided'}
How I Did It: ${role.howIDidIt || 'Not provided'}
The Impact: ${role.impact || 'Not provided'}`;
    }).join('\n\n');

    const psaText = `
Passions: ${mentee.passions || 'Not provided'}
Strengths: ${mentee.strengths || 'Not provided'}
Aspirations: ${mentee.aspirations || 'Not provided'}
Table Stakes (Non-Negotiables): ${mentee.tableStakes || 'Not provided'}
${mentee.tableStakesTags && mentee.tableStakesTags.length > 0 ? `Table Stakes Tags: ${mentee.tableStakesTags.join(', ')}` : ''}`;

    const careerThreadText = mentee.careerThread
      ? `\nThe mentee has identified the following thread that runs through their career: "${mentee.careerThread}". Honor this self-identified thread in the narrative — use their own framing where possible, as it will feel most authentic to them.`
      : '';

    const systemPrompt = `You are an expert career coach helping a military veteran craft a compelling civilian career narrative. Based on their career history and self-assessment below, write a first-person "tell me about yourself" narrative they can use at networking events, job fairs, conferences, or in interviews.

CRITICAL REQUIREMENTS:
- Written in first person, as if they are speaking it aloud to someone they just met
- Completely free of military jargon, acronyms, rank structures, or insider language
- Understandable and compelling to anyone, regardless of their knowledge of the military
- 150-200 words — substantive enough to be meaningful, concise enough to hold attention
- Structure: opening hook → career progression thread → key strengths and themes → forward-looking close
- Conversational and natural — not a resume being read aloud
- Emphasize transferable skills: leadership, problem-solving, managing complexity, developing people, delivering results under pressure
- The closing sentence should reflect what kind of role or environment they are seeking, informed by their table stakes and aspirations
${careerThreadText}

STRENGTHS VALIDATION CHECK:
Review the strengths section. If it appears to contain only self-declared attributes (phrases like "I am good at", "I have always been", "I excel at") with no external validation language (no phrases like "told me", "feedback", "recognized", "praised", "said I was", "my supervisor", "my colleague", "my teammate"), set a flag to include a note about this in the refinementNote.

After the narrative, provide:
- 3-5 Career Themes: recurring strengths or competitive differentiators you detected across their roles. These should be specific and distinctive — not generic (e.g., "Translating complexity into clear action for diverse audiences" not just "Communication skills"). These themes are what will inform their resume bullets and interview answer bank.
- A brief note on what is strongest about this narrative
- One specific suggestion for how they might refine it further

Return as JSON:
{
  "narrative": "the full first-person narrative text",
  "themes": ["Theme 1", "Theme 2", "Theme 3"],
  "narrativeStrength": "what is working well",
  "refinementNote": "one specific refinement suggestion. If the strengths section lacked external validation language, prepend: 'Your strengths section may benefit from more external validation — try attributing each strength to specific feedback you received from a supervisor or colleague. ' before your other refinement note."
}`;

    const userMessage = `Here is ${mentee.name}'s career history and self-assessment:

CAREER HISTORY:
${rolesText || 'No roles provided'}

SELF-ASSESSMENT:
${psaText}

Please write their civilian career narrative and provide themes and feedback.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    const rawText = response.content[0].text;

    let result;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse narrative response:', parseErr);
      return res.status(500).json({
        error: 'Narrative generation unavailable right now — try again in a moment.'
      });
    }

    const now = new Date();
    mentee.generatedNarrative = result.narrative;
    mentee.themes = result.themes;
    mentee.narrativeGeneratedAt = now;
    mentee.themesGeneratedAt = now;
    mentee.updatedAt = now;
    if (careerThreadFromRequest !== undefined) {
      mentee.careerThread = careerThreadFromRequest;
    }
    await mentee.save();

    res.json({
      narrative: result.narrative,
      themes: result.themes,
      narrativeStrength: result.narrativeStrength,
      refinementNote: result.refinementNote,
      mentee
    });
  } catch (err) {
    console.error('Error generating narrative:', err);
    res.status(500).json({
      error: 'Narrative generation unavailable right now — try again in a moment.'
    });
  }
});

// ── POST /api/analyze-psa ─────────────────────────────────────────────────────
router.post('/analyze-psa', async (req, res) => {
  try {
    const { menteeId } = req.body;

    if (!menteeId) {
      return res.status(400).json({ error: 'menteeId is required' });
    }

    const mentee = await Mentee.findOne({ id: menteeId });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    const systemPrompt = `You are an expert career coach reviewing a military veteran's self-assessment of their passions, strengths, and aspirations. Your job is to identify patterns, alignments, and tensions across the three sections that the person themselves may not have noticed.

Look for:
1. ALIGNMENTS: Where passions and strengths overlap — activities they enjoy AND are recognized as good at. These are the strongest signals for career targeting.
2. TENSIONS: Where aspirations conflict with passions or strengths. For example, aspiring to a leadership role while noting that meetings and conflict resolution drain energy. Name these directly but constructively.
3. CAREER SIGNALS: Any specific interests, skills, or environments mentioned that point toward a particular type of role or industry — especially anything that seems surprising or different from what their career history might suggest.
4. MISSING DIMENSION: What seems underrepresented or vague that would be worth exploring in a mentoring conversation.

Return as JSON:
{
  "alignments": [
    {"insight": "specific alignment observation", "implication": "what this means for career targeting"}
  ],
  "tensions": [
    {"insight": "specific tension observation", "question": "a coaching question to explore this tension"}
  ],
  "careerSignals": [
    {"signal": "specific signal or interest noted", "possibleDirection": "what role or industry this might point toward"}
  ],
  "missingDimension": "what seems underexplored and worth discussing",
  "coachingPriority": "the single most important thing a mentor should explore in the next session based on this self-assessment"
}`;

    const userMessage = `Please analyze this veteran's Passions, Strengths, and Aspirations self-assessment:

PASSIONS:
${mentee.passions || '(not provided)'}

STRENGTHS:
${mentee.strengths || '(not provided)'}

ASPIRATIONS:
${mentee.aspirations || '(not provided)'}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const rawText = response.content[0].text;

    let analysis;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse PSA analysis response:', parseErr);
      return res.status(500).json({
        error: 'Analysis unavailable right now — try again in a moment.'
      });
    }

    const now = new Date();
    mentee.psaAnalysis = { ...analysis, analyzedAt: now };
    mentee.updatedAt = now;
    mentee.markModified('psaAnalysis');
    await mentee.save();

    res.json({ analysis: mentee.psaAnalysis, mentee });
  } catch (err) {
    console.error('Error analyzing PSA:', err);
    res.status(500).json({
      error: 'Analysis unavailable right now — try again in a moment.'
    });
  }
});

module.exports = router;
