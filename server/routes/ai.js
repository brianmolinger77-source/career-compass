const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const Mentee = require('../models/Mentee');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = 'claude-sonnet-4-20250514';

const ApiUsageLog = require('../models/ApiUsageLog');

async function logUsage(endpoint, menteeId, mentorId, usage) {
  try {
    await ApiUsageLog.create({
      endpoint,
      menteeId: menteeId || '',
      mentorId: mentorId || '',
      model: MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Usage log write failed:', err);
  }
}

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

${mentee.militaryBranch ? `Military branch: ${mentee.militaryBranch}\n` : ''}
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
    logUsage('analyze-role', mentee.id, mentee.mentorId, response.usage);

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
- 3-5 Career Themes: recurring strengths or competitive differentiators you detected across their roles. These should be specific and distinctive noun phrases — not generic, and not gerunds starting with "-ing" verbs (e.g., "Cross-functional operational leadership" not "Leading cross-functional teams"; "Data-driven decision support" not "Translating data into decisions"). These themes appear as Core Competencies on the veteran's resume, so they must read as professional resume credentials, not activity descriptions.
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

${mentee.militaryBranch ? `Military branch: ${mentee.militaryBranch}\n` : ''}
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
    logUsage('generate-narrative', mentee.id, mentee.mentorId, response.usage);

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

${mentee.militaryBranch ? `Military branch: ${mentee.militaryBranch}\n` : ''}
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
    logUsage('analyze-psa', mentee.id, mentee.mentorId, response.usage);

    res.json({ analysis: mentee.psaAnalysis, mentee });
  } catch (err) {
    console.error('Error analyzing PSA:', err);
    res.status(500).json({
      error: 'Analysis unavailable right now — try again in a moment.'
    });
  }
});

// ── POST /api/generate-resume-bullets ────────────────────────────────────────
router.post('/generate-resume-bullets', async (req, res) => {
  try {
    const { menteeId } = req.body;

    if (!menteeId) {
      return res.status(400).json({ error: 'menteeId is required' });
    }

    const mentee = await Mentee.findOne({ id: menteeId });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    if (!mentee.roles || mentee.roles.length === 0) {
      return res.status(400).json({ error: 'At least one role is required to generate resume bullets' });
    }

    const rolesText = mentee.roles.map(role => {
      const jargonContext = role.aiFeedback?.jargonFlags?.length
        ? `Jargon to avoid: ${role.aiFeedback.jargonFlags.map(f => f.term).join(', ')}`
        : '';
      return `---
Role ID: ${role.id}
Title: ${role.title || 'Untitled'}
Organization: ${role.organization || 'Unknown'}
Years: ${role.startYear || '?'} – ${role.endYear || 'Present'}
What They Did: ${role.whatIDid || 'Not provided'}
How They Did It: ${role.howIDidIt || 'Not provided'}
The Impact: ${role.impact || 'Not provided'}
${jargonContext}
---`;
    }).join('\n\n');

    const themesContext = mentee.themes?.length
      ? `Career themes identified across all roles: ${mentee.themes.join(', ')}`
      : '';

    const systemPrompt = `You are an expert resume writer specializing in helping military veterans translate their service into compelling civilian resumes. You will generate two things: (1) a Professional Summary and (2) resume bullet points for each role.

── PROFESSIONAL SUMMARY ────────────────────────────────────────────────────────
Write exactly 3 sentences. No more, no fewer.

Sentence 1 — Professional identity: Lead with their strongest differentiator. Who are they at their best? Do NOT start with "I", "I'm", or "I am". Open with a strong declarative statement about their professional value (e.g. "A proven operations leader who...", "Recognized for...", "Trusted by...").

Sentence 2 — Proof: One specific quantified achievement that proves the claim in Sentence 1. If no metrics exist in the source material, name the most concrete and specific thing that changed because of their work.

Sentence 3 — What they are seeking: A concrete, forward-looking statement about the type of role, contribution, or environment they are targeting.

Quality bar: After reading these 3 sentences, a hiring manager must immediately understand this person's brand and want to learn more. Do NOT retell their career chronologically. Do NOT use generic phrases like "results-driven" or "team player" without specifics. Be direct and specific to this person's actual experience.

── RESUME BULLETS ──────────────────────────────────────────────────────────────
For each role provided, generate exactly 3–4 strong bullet points:
- Start with a strong past-tense action verb (Led, Managed, Developed, Reduced, Delivered, Coordinated, etc.)
- Quantify impact wherever the source material contains numbers, scale, percentages, or dollar amounts
- Completely jargon-free — understandable to any civilian hiring manager with zero military knowledge
- One to two lines maximum per bullet
- Do NOT end bullets with a period
- Prioritize leadership, business impact, and scale over task lists
- Never use "we" or "our team" — hiring managers need to understand this person's specific contribution and role in the outcome. Attribute every action directly to the veteran. This is not about taking sole credit — it is about clarity.
- If no metrics exist, describe what specifically changed or was delivered — not just what the veteran did

VETERAN CONTEXT: This person served in the US military. Their instinct is to credit the team over themselves and to use language only insiders understand. Your job is to surface their individual contribution in plain civilian language. Translate rank, unit designations, and military acronyms into civilian equivalents. "Battalion" becomes "500-person organization." "OIC" becomes "officer in charge." Write for a hiring manager who has never served.

Return ONLY valid JSON in this exact format, with no extra text before or after:
{
  "summary": "Sentence 1. Sentence 2. Sentence 3.",
  "bullets": {
    "[roleId]": ["bullet 1", "bullet 2", "bullet 3"]
  }
}

Include every roleId provided. Generate exactly 3–4 bullets per role.`;

    const psaContext = [
      mentee.passions   ? `Passions: ${mentee.passions}`     : '',
      mentee.strengths  ? `Strengths: ${mentee.strengths}`   : '',
      mentee.aspirations? `Aspirations: ${mentee.aspirations}`: '',
      mentee.tableStakes? `Table Stakes: ${mentee.tableStakes}`: '',
    ].filter(Boolean).join('\n');

    const userMessage = `Generate a professional summary and resume bullets for ${mentee.name}.

${mentee.militaryBranch ? `Military branch: ${mentee.militaryBranch}\n` : ''}
CAREER HISTORY:
${rolesText}

${themesContext}

${psaContext ? `SELF-ASSESSMENT:\n${psaContext}` : ''}

${mentee.generatedNarrative ? `CAREER NARRATIVE (use as context only — do not copy):\n${mentee.generatedNarrative}` : ''}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
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
      console.error('Failed to parse resume bullets response:', parseErr);
      return res.status(500).json({
        error: 'Resume bullet generation unavailable right now — try again in a moment.'
      });
    }

    const now = new Date();
    mentee.resumeBullets = result.bullets;
    mentee.resumeSummary = result.summary || '';
    mentee.resumeSkills = mentee.themes || [];
    mentee.resumeGeneratedAt = now;
    mentee.updatedAt = now;
    mentee.markModified('resumeBullets');
    await mentee.save();
    logUsage('generate-resume-bullets', mentee.id, mentee.mentorId, response.usage);

    res.json({ roleBullets: result.bullets, resumeSummary: result.summary || '', resumeGeneratedAt: now, mentee });
  } catch (err) {
    console.error('Error generating resume bullets:', err);
    res.status(500).json({
      error: 'Resume bullet generation unavailable right now — try again in a moment.'
    });
  }
});

// ── POST /api/regenerate-summary ─────────────────────────────────────────────
router.post('/regenerate-summary', async (req, res) => {
  try {
    const { menteeId } = req.body;

    if (!menteeId) {
      return res.status(400).json({ error: 'menteeId is required' });
    }

    const mentee = await Mentee.findOne({ id: menteeId });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    const rolesText = (mentee.roles || []).map(role =>
      `${role.title || 'Untitled'} at ${role.organization || 'Unknown'} (${role.startYear || '?'}–${role.endYear || 'Present'}):
What I Did: ${role.whatIDid || ''}
How I Did It: ${role.howIDidIt || ''}
Impact: ${role.impact || ''}`.trim()
    ).join('\n');

    const systemPrompt = `Write a Professional Summary of exactly 3 sentences for a resume. Maximum 60 words total.

STRICT RULES — violating any of these is a failure:
- Do NOT start with "I", "I'm", "I am", or "My"
- No filler phrases ("someone who thrives on", "passionate about", "results-driven", "team player")
- Every word must earn its place

Sentence 1: A declarative statement leading with their strongest professional differentiator. Structure: "[Adjective] [professional identity] who [specific value proposition]."
Sentence 2: One specific quantified achievement that proves the claim in Sentence 1.
Sentence 3: The role they are targeting and one concrete reason they are ready for it.

Return ONLY valid JSON: {"summary": "Sentence 1. Sentence 2. Sentence 3."}`;

    const psaContext = [
      mentee.passions    ? `Passions: ${mentee.passions}`      : '',
      mentee.strengths   ? `Strengths: ${mentee.strengths}`    : '',
      mentee.aspirations ? `Aspirations: ${mentee.aspirations}` : '',
      mentee.tableStakes ? `Table Stakes: ${mentee.tableStakes}`: '',
    ].filter(Boolean).join('\n');

    const userMessage = `Generate a 3-sentence professional summary for ${mentee.name}.

${mentee.militaryBranch ? `Military branch: ${mentee.militaryBranch}\n` : ''}
${mentee.themes?.length ? `Career themes: ${mentee.themes.join(', ')}\n` : ''}
CAREER HISTORY:
${rolesText || 'Not provided'}

${psaContext ? `SELF-ASSESSMENT:\n${psaContext}` : ''}

${mentee.generatedNarrative ? `CAREER NARRATIVE (use as context only — do not copy):\n${mentee.generatedNarrative}` : ''}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
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
      console.error('Failed to parse summary response:', parseErr);
      return res.status(500).json({
        error: 'Summary generation unavailable right now — try again in a moment.'
      });
    }

    const now = new Date();
    mentee.resumeSummary = result.summary || '';
    mentee.updatedAt = now;
    await mentee.save();
    logUsage('regenerate-summary', mentee.id, mentee.mentorId, response.usage);

    res.json({ resumeSummary: result.summary || '', mentee });
  } catch (err) {
    console.error('Error regenerating summary:', err);
    res.status(500).json({
      error: 'Summary generation unavailable right now — try again in a moment.'
    });
  }
});

// ── POST /api/evaluate-job-posting ───────────────────────────────────────────
router.post('/evaluate-job-posting', async (req, res) => {
  try {
    const { menteeId, jobPostingText } = req.body;

    if (!menteeId || !jobPostingText) {
      return res.status(400).json({ error: 'menteeId and jobPostingText are required' });
    }

    const mentee = await Mentee.findOne({ id: menteeId });
    if (!mentee) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    // Readiness gate
    const hasRole = mentee.roles && mentee.roles.length > 0;
    const hasTableStake = mentee.tableStakes && mentee.tableStakes.trim().length > 0;
    const hasPSA = mentee.passions && mentee.passions.trim().length > 0
                && mentee.strengths && mentee.strengths.trim().length > 0
                && mentee.aspirations && mentee.aspirations.trim().length > 0;

    if (!hasRole || !hasTableStake || !hasPSA) {
      return res.status(400).json({
        error: 'readiness_gate',
        message: 'To use this feature, you need at least one career history entry, something in all three PSA fields (Passions, Strengths, and Aspirations), and at least one table stake.'
      });
    }

    const profileText = `
CAREER HISTORY:
${mentee.roles.map((r, i) => `Role ${i + 1}: ${r.title || 'Untitled'} at ${r.organization || 'Unknown'} (${r.startYear || '?'} - ${r.endYear || 'Present'})
What I Did: ${r.whatIDid || 'Not provided'}
How I Did It: ${r.howIDidIt || 'Not provided'}
The Impact: ${r.impact || 'Not provided'}`).join('\n\n')}

PASSIONS: ${mentee.passions || 'Not provided'}
STRENGTHS: ${mentee.strengths || 'Not provided'}
ASPIRATIONS: ${mentee.aspirations || 'Not provided'}
TABLE STAKES (non-negotiables): ${mentee.tableStakes || 'Not provided'}
${mentee.themes && mentee.themes.length > 0 ? `CAREER THEMES: ${mentee.themes.join(', ')}` : ''}
${mentee.resumeEducation && mentee.resumeEducation.length > 0 ? `EDUCATION: ${mentee.resumeEducation.join(', ')}` : ''}
${mentee.resumeCertifications && mentee.resumeCertifications.length > 0 ? `CERTIFICATIONS: ${mentee.resumeCertifications.join(', ')}` : ''}`;

    const systemPrompt = `You are supporting a military veteran in evaluating a job posting against their career profile. Your job is to act as a mirror, not an advisor. You reflect the veteran's own words back to them in the context of the posting. You never tell them whether to apply. You never make judgments about whether this is a good or bad opportunity. You hold your conclusions loosely — you know you have an incomplete picture. The job description may not capture everything about the role or culture. The veteran's profile may not capture everything about who they are.

Analyze the job posting against the veteran's profile and return four buckets:

**ALIGNS** — Specific, concrete connections between what the posting describes and what appears in the veteran's profile. Name both the posting element and the profile element it connects to. If no clear alignments exist, return an empty array — do not manufacture encouragement.

**DIFFERENCES** — Gaps or mismatches between this posting and this veteran's specific profile that are worth noting but are not direct conflicts. Each difference must be grounded in something specific in the posting and something specific in the profile — not generic observations that would apply to any veteran making a military-to-civilian transition. Do not surface differences like "civilian vs military environment" or "corporate culture adjustment" — these are universal and add no value. Frame genuine differences neutrally as observations, not problems.

**UNKNOWNS** — Things the posting implies but doesn't explicitly state, where the profile also doesn't give enough to assess. Frame these as questions worth asking the employer or thinking through before applying.

**CONFLICTS** — Maximum three items, selected in this priority order:
1. Anything that directly contradicts a stated table stake
2. Quality of life factors (travel requirements, remote vs. in-person, work schedule, work environment) that conflict with something explicitly stated in the PSAs
3. Credentials, degrees, certifications, or years of experience explicitly labeled "required" in the posting that are NOT present in the veteran's education, certifications, or career history. If the veteran's profile already contains the credential, do NOT flag it as a conflict — move it to ALIGNS instead.

For conflicts involving a table stake or quality of life factor, include a reflecting question in a mentor tone: "You've told us that [X] matters to you. This posting suggests [Y]. How does that sit with what you're looking for?"
For conflicts involving missing required credentials: "This posting lists [credential] as required. We don't see that in your profile — think about how you will talk to that gap."

CRITICAL CONSTRAINTS:
- Never surface a conflict that cannot be grounded in something the veteran has explicitly written in their profile
- Never infer preferences or values that are not stated
- If fewer than three conflicts exist, return only what genuinely qualifies — do not pad to reach three
- Output is preparation for a conversation, never a final assessment

Also extract the job title from the posting for display purposes.

Return ONLY valid JSON in this exact format:
{
  "jobTitle": "extracted job title from the posting, or 'Job Posting' if not clearly stated",
  "aligns": ["specific alignment 1", "specific alignment 2"],
  "differences": ["difference 1", "difference 2"],
  "unknowns": ["unknown 1", "unknown 2"],
  "conflicts": [
    { "observation": "the conflict", "reflectingQuestion": "the mentor-tone question" }
  ]
}`;

    const userMessage = `Here is the veteran's career profile:

${mentee.militaryBranch ? `Military branch: ${mentee.militaryBranch}\n` : ''}
${profileText}

Here is the job posting to evaluate:

${jobPostingText}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
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
      console.error('Failed to parse job evaluation response:', parseErr);
      return res.status(500).json({
        error: 'Analysis unavailable right now — try again in a moment.'
      });
    }

    // Persist to jobAnalyses array
    const now = new Date();
    const analysisId = `job-${Date.now()}`;

    if (!mentee.jobAnalyses) mentee.jobAnalyses = [];
    mentee.jobAnalyses.push({
      id: analysisId,
      jobTitle: result.jobTitle || 'Job Posting',
      jobPostingText,
      analyzedAt: now,
      aligns: result.aligns || [],
      differences: result.differences || [],
      unknowns: result.unknowns || [],
      conflicts: result.conflicts || [],
      mentorFlagged: true
    });

    mentee.updatedAt = now;
    mentee.markModified('jobAnalyses');
    await mentee.save();
    logUsage('evaluate-job-posting', mentee.id, mentee.mentorId, response.usage);

    res.json({
      analysisId,
      jobTitle: result.jobTitle || 'Job Posting',
      aligns: result.aligns || [],
      differences: result.differences || [],
      unknowns: result.unknowns || [],
      conflicts: result.conflicts || [],
      mentee
    });

  } catch (err) {
    console.error('Error evaluating job posting:', err);
    res.status(500).json({
      error: 'Analysis unavailable right now — try again in a moment.'
    });
  }
});


module.exports = router;
