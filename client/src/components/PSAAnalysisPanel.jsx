import React from 'react'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

export default function PSAAnalysisPanel({ psaAnalysis, isMentorView = false, onReAnalyze, isAnalyzing = false }) {
  if (!psaAnalysis) return null

  const { alignments = [], tensions = [], careerSignals = [], missingDimension, coachingPriority, analyzedAt } = psaAnalysis

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          {isMentorView ? (
            <h3 className="text-base font-bold text-[#1F4E79]">AI Coaching Observations — PSA Cross-Analysis</h3>
          ) : (
            <h3 className="text-base font-bold text-[#1F4E79]">Passions, Strengths &amp; Aspirations — Cross-Analysis</h3>
          )}
          {analyzedAt && (
            <p className="text-xs text-gray-400 mt-0.5">Analyzed {formatDate(analyzedAt)}</p>
          )}
        </div>
        {isMentorView && onReAnalyze && (
          <button
            onClick={onReAnalyze}
            disabled={isAnalyzing}
            className="text-xs text-[#1F4E79] border border-[#1F4E79] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 no-print"
          >
            {isAnalyzing ? 'Re-analyzing...' : 'Re-Analyze'}
          </button>
        )}
      </div>

      {/* Alignments */}
      {alignments.length > 0 && (
        <div className="border-l-4 border-green-500 pl-4 py-3 bg-green-50 rounded-r-lg space-y-3">
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Where Your Passions &amp; Strengths Align</p>
          {alignments.map((item, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-sm text-gray-800">{item.insight}</p>
              <p className="text-xs text-green-700 italic">{item.implication}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tensions */}
      {tensions.length > 0 && (
        <div className="border-l-4 border-amber-400 pl-4 py-3 bg-amber-50 rounded-r-lg space-y-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Tensions Worth Exploring</p>
          {tensions.map((item, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm text-gray-800">{item.insight}</p>
              <p className="text-xs text-amber-800 italic">&#8227; {item.question}</p>
            </div>
          ))}
        </div>
      )}

      {/* Career Signals */}
      {careerSignals.length > 0 && (
        <div className="border-l-4 border-[#1F4E79] pl-4 py-3 bg-blue-50 rounded-r-lg space-y-3">
          <p className="text-xs font-semibold text-[#1F4E79] uppercase tracking-wide">Career Signals</p>
          {careerSignals.map((item, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-sm text-gray-800">{item.signal}</p>
              <p className="text-xs text-blue-700 italic">{item.possibleDirection}</p>
            </div>
          ))}
        </div>
      )}

      {/* Missing Dimension */}
      {missingDimension && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What Seems Underexplored</p>
          <p className="text-sm text-gray-700">{missingDimension}</p>
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
