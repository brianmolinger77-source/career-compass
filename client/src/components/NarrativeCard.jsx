import React, { useState } from 'react'

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function NarrativeCard({
  narrative,
  themes = [],
  narrativeStrength,
  refinementNote,
  narrativeGeneratedAt,
  onRegenerate,
  isGenerating
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(narrative || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!narrative) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#1F4E79] px-6 py-4">
        <h2 className="text-xl font-bold text-white">My Career Story</h2>
        <p className="text-blue-200 text-sm mt-0.5">
          Your &ldquo;tell me about yourself&rdquo; — crafted for the civilian world
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Narrative text */}
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
          <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap font-serif">
            {narrative}
          </p>
        </div>

        {/* Copy button */}
        <div className="flex items-center gap-3 no-print">
          <button
            onClick={handleCopy}
            className={`text-sm px-4 py-2 rounded-lg border font-medium transition-all ${
              copied
                ? 'bg-green-50 text-green-700 border-green-300'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#1F4E79] hover:text-[#1F4E79]'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="text-sm px-4 py-2 rounded-lg bg-[#C65911] hover:bg-[#a34a0e] text-white font-medium disabled:opacity-60 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerating...
              </>
            ) : (
              'Regenerate'
            )}
          </button>
          {narrativeGeneratedAt && (
            <span className="text-xs text-gray-400">
              Generated {formatDate(narrativeGeneratedAt)}
            </span>
          )}
        </div>

        {/* Themes */}
        {themes && themes.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
              Your Career Themes
            </h3>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <span
                  key={i}
                  className="bg-[#1F4E79] text-white text-sm px-4 py-1.5 rounded-full font-medium"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Narrative Strength */}
        {narrativeStrength && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">
              What's Working Well
            </p>
            <p className="text-sm text-green-900 leading-relaxed">{narrativeStrength}</p>
          </div>
        )}

        {/* Refinement Note */}
        {refinementNote && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
              One Thing to Refine
            </p>
            <p className="text-sm text-amber-900 leading-relaxed">{refinementNote}</p>
          </div>
        )}
      </div>
    </div>
  )
}
