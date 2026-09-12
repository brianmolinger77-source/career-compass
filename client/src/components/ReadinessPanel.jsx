import React from 'react'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

export default function ReadinessPanel({ readinessAnalysis, isMentorView = false }) {
  if (!readinessAnalysis) return null

  const {
    patternsIdentified = [],
    vaguenessFlags = {},
    thematicConsistency = {},
    coachingPriority,
    analyzedAt
  } = readinessAnalysis

  const { psa = [], roles = [], narrative = [] } = vaguenessFlags
  const allVaguenessFlags = [
    ...psa.map(f => ({ ...f, sectionLabel: f.section })),
    ...roles.map(f => ({ ...f, sectionLabel: f.roleTitle })),
    ...narrative.map(f => ({ ...f, sectionLabel: 'Narrative' })),
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-[#1F4E79]">
          {isMentorView ? 'AI Coaching Observations — Where This Veteran Stands' : 'Where You Stand'}
        </h3>
        {analyzedAt && (
          <p className="text-xs text-gray-500 mt-0.5">Analyzed {formatDate(analyzedAt)}</p>
        )}
      </div>

      {/* Patterns Identified */}
      {patternsIdentified.length > 0 && (
        <div className="border-l-4 border-teal-500 pl-4 py-3 bg-teal-50 rounded-r-lg space-y-4">
          <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Patterns Worth Building On</p>
          {patternsIdentified.map((pattern, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-bold text-gray-800">{pattern.theme}</p>
              {(pattern.evidence || []).map((ev, j) => (
                <p key={j} className="text-xs text-gray-600">
                  <span className="font-semibold capitalize">{ev.source}:</span> {ev.detail}
                </p>
              ))}
              {pattern.whyItMatters && (
                <p className="text-xs text-teal-700 italic">{pattern.whyItMatters}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vagueness Flags */}
      {allVaguenessFlags.length > 0 && (
        <div className="border-l-4 border-amber-400 pl-4 py-3 bg-amber-50 rounded-r-lg space-y-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Where to Get More Specific</p>
          {allVaguenessFlags.map((flag, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">{flag.sectionLabel}</p>
              <p className="text-sm text-gray-800">&ldquo;{flag.quote}&rdquo;</p>
              <p className="text-xs text-gray-600">{flag.why}</p>
              {flag.prompt && (
                <p className="text-xs text-amber-800 italic">&#8227; {flag.prompt}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thematic Consistency */}
      {(thematicConsistency.assessment || thematicConsistency.gaps) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">How It All Fits Together</p>
          {thematicConsistency.assessment && (
            <p className="text-sm text-gray-700">{thematicConsistency.assessment}</p>
          )}
          {thematicConsistency.strongestThread && (
            <p className="text-xs text-gray-600"><span className="font-semibold">Strongest thread:</span> {thematicConsistency.strongestThread}</p>
          )}
          {thematicConsistency.gaps && (
            <p className="text-xs text-gray-600"><span className="font-semibold">Gaps:</span> {thematicConsistency.gaps}</p>
          )}
        </div>
      )}

      {/* Coaching Priority */}
      {coachingPriority && (
        <div className="bg-[#7B2D3E] text-white rounded-lg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-red-200">For Your Next Session</p>
          <p className="text-sm leading-relaxed">{coachingPriority}</p>
        </div>
      )}
    </div>
  )
}
