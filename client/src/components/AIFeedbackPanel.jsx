import React from 'react'

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Shared styles
const SECTION_BOX  = 'bg-white border border-[#CCCCCC] rounded-lg p-4'
const SECTION_HEAD = 'text-sm font-bold text-[#7B1C1C] mb-2'
const BODY_TEXT    = 'text-sm text-[#222222] leading-relaxed'
const TEAL         = '#0D6B6B'

export default function AIFeedbackPanel({ feedback, lastAnalyzed }) {
  if (!feedback) return null

  return (
    <div className="ai-feedback-panel mt-4 space-y-5 border-t border-gray-100 pt-4">

      {/* ── Panel header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          AI Coaching Feedback
        </h4>
        {lastAnalyzed && (
          <span className="text-xs text-gray-400">
            Analyzed {formatDate(lastAnalyzed)}
          </span>
        )}
      </div>

      {/* ── Priority Action — dark navy, white text, unchanged ────────────────── */}
      {feedback.priorityAction && (
        <div className="bg-[#1F4E79] text-white rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
            Priority Action
          </p>
          <p className="text-sm leading-relaxed">{feedback.priorityAction}</p>
        </div>
      )}

      {/* ── What's Working Well — only renders if AI returned non-null content ── */}
      {feedback.overallStrength && (
        <div className={SECTION_BOX}>
          <p className={SECTION_HEAD}>What's Working Well</p>
          <p className={BODY_TEXT}>{feedback.overallStrength}</p>
        </div>
      )}

      {/* ── Military Jargon to Translate — one card per flagged term ─────────── */}
      {feedback.jargonFlags && feedback.jargonFlags.length > 0 && (
        <div className="space-y-3">
          <p className={SECTION_HEAD}>
            Military Jargon to Translate ({feedback.jargonFlags.length})
          </p>
          {feedback.jargonFlags.map((flag, i) => (
            <div key={i} className={SECTION_BOX}>
              <p className="text-sm font-bold text-[#222222]">
                &ldquo;{flag.term}&rdquo;
              </p>
              <p className="text-sm text-[#222222] mt-1 leading-relaxed">
                {flag.explanation}
              </p>
              {flag.suggestion && (
                <p className="text-sm mt-2 leading-relaxed">
                  <span className="font-bold" style={{ color: TEAL }}>Try instead: </span>
                  <span style={{ color: TEAL }}>{flag.suggestion}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add the How ──────────────────────────────────────────────────────── */}
      {feedback.missingHow && feedback.missingHow.detected && (
        <div className={SECTION_BOX}>
          <p className={SECTION_HEAD}>Add the How</p>
          <p className={BODY_TEXT}>{feedback.missingHow.feedback}</p>
          {feedback.missingHow.promptingQuestions && feedback.missingHow.promptingQuestions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {feedback.missingHow.promptingQuestions.map((q, i) => (
                <li key={i} className="text-sm text-[#222222] flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Add the Impact ───────────────────────────────────────────────────── */}
      {feedback.missingImpact && feedback.missingImpact.detected && (
        <div className={SECTION_BOX}>
          <p className={SECTION_HEAD}>Add the Impact</p>
          <p className={BODY_TEXT}>{feedback.missingImpact.feedback}</p>
          {feedback.missingImpact.promptingQuestions && feedback.missingImpact.promptingQuestions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {feedback.missingImpact.promptingQuestions.map((q, i) => (
                <li key={i} className="text-sm text-[#222222] flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

    </div>
  )
}
