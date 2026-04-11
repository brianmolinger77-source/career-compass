import React from 'react'

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ThemesPanel({ themes = [], themesGeneratedAt, onRegenerate, isGenerating, hasEnoughRoles }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1F4E79]">Competitive Differentiators</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Recurring strengths that set this candidate apart
          </p>
        </div>
        {hasEnoughRoles && themes.length > 0 && (
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="no-print text-sm px-4 py-2 bg-[#C65911] hover:bg-[#a34a0e] text-white rounded-lg font-medium disabled:opacity-60 flex items-center gap-2 flex-shrink-0"
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
        )}
      </div>

      {!hasEnoughRoles ? (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 italic">
            Generate a career story after adding at least 2 roles to surface this candidate's competitive differentiators.
          </p>
        </div>
      ) : themes.length === 0 ? (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 italic">
            No themes generated yet. Use the &ldquo;Generate My Story&rdquo; button below to surface competitive differentiators.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {themes.map((theme, i) => (
              <span
                key={i}
                className="bg-[#1F4E79] text-white text-sm px-4 py-2 rounded-full font-medium leading-tight"
              >
                {theme}
              </span>
            ))}
          </div>
          {themesGeneratedAt && (
            <p className="text-xs text-gray-400">
              Generated {formatDate(themesGeneratedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
