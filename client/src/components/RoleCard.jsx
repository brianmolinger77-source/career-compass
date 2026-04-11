import React, { useState, useRef, useCallback } from 'react'
import AIFeedbackPanel from './AIFeedbackPanel'
import MentorComment from './MentorComment'
import { analyzeRole } from '../utils/api'

const FIELD_DEFINITIONS = {
  whatIDid: {
    label: 'What I Did',
    definition: 'The core responsibilities, tasks, and scope of your role. Think about what you were accountable for day to day and what a performance review would list as your primary duties.',
    placeholder: 'Describe the responsibilities and tasks that defined this role. What were you accountable for? What did your typical week look like?'
  },
  howIDidIt: {
    label: 'How I Did It',
    definition: 'The approach, methods, and style that made you effective. This is about how you led people, built relationships, navigated complexity, made decisions, or solved problems — not just the tasks themselves.',
    placeholder: 'How did you approach the work? How did you lead people, manage relationships, prioritize under pressure, or navigate complex situations? What was your approach or method?'
  },
  impact: {
    label: 'The Impact',
    definition: 'What changed or improved because of your work. Think in terms of outcomes: people developed, processes improved, risk reduced, resources saved, mission accomplished. Use numbers and specifics wherever you can.',
    placeholder: 'What changed or improved because of your work? Think outcomes, not activities. Numbers, scale, and specifics make impact credible — even estimates help.'
  }
}

export default function RoleCard({
  role,
  menteeId,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isMentorView = false,
  mentorComments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  isFirst,
  isLast
}) {
  const [localRole, setLocalRole] = useState(role)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const debounceTimers = useRef({})

  function handleFieldChange(field, value) {
    const updated = { ...localRole, [field]: value }
    setLocalRole(updated)

    // Debounce autosave
    if (debounceTimers.current[field]) clearTimeout(debounceTimers.current[field])
    debounceTimers.current[field] = setTimeout(() => {
      onUpdate(role.id, { [field]: value })
    }, 1500)
  }

  async function handleAnalyze() {
    setIsAnalyzing(true)
    setAnalyzeError(null)
    try {
      const result = await analyzeRole(
        menteeId,
        role.id,
        localRole.whatIDid,
        localRole.howIDidIt,
        localRole.impact
      )
      setLocalRole(prev => ({
        ...prev,
        aiFeedback: result.feedback,
        lastAnalyzed: new Date().toISOString()
      }))
    } catch (err) {
      setAnalyzeError('Analysis unavailable right now — try again in a moment. Your content has been saved.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete(role.id)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Job Title
            </label>
            <input
              type="text"
              value={localRole.title || ''}
              onChange={e => handleFieldChange('title', e.target.value)}
              placeholder="e.g. Operations Manager"
              className="w-full text-base font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Organization
            </label>
            <input
              type="text"
              value={localRole.organization || ''}
              onChange={e => handleFieldChange('organization', e.target.value)}
              placeholder="e.g. U.S. Army / Company name"
              className="w-full text-base border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent"
            />
          </div>
        </div>

        {/* Move up/down + delete controls */}
        <div className="flex flex-col items-center gap-1 no-print">
          {!isFirst && (
            <button
              onClick={() => onMoveUp(role.id)}
              title="Move up"
              className="text-gray-400 hover:text-[#1F4E79] p-1 rounded"
            >
              &#9650;
            </button>
          )}
          {!isLast && (
            <button
              onClick={() => onMoveDown(role.id)}
              title="Move down"
              className="text-gray-400 hover:text-[#1F4E79] p-1 rounded"
            >
              &#9660;
            </button>
          )}
        </div>
      </div>

      {/* Years */}
      <div className="flex gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Start Year
          </label>
          <input
            type="text"
            value={localRole.startYear || ''}
            onChange={e => handleFieldChange('startYear', e.target.value)}
            placeholder="2010"
            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            End Year
          </label>
          <input
            type="text"
            value={localRole.endYear || ''}
            onChange={e => handleFieldChange('endYear', e.target.value)}
            placeholder="2015 or Present"
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
          />
        </div>
      </div>

      {/* Three text areas */}
      {['whatIDid', 'howIDidIt', 'impact'].map(field => {
        const def = FIELD_DEFINITIONS[field]
        return (
          <div key={field} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-800">{def.label}</label>
            </div>

            {/* Definition callout */}
            <div className="bg-gray-50 border-l-4 border-[#1F4E79] pl-3 py-2 rounded-r text-xs text-gray-600 leading-relaxed">
              {def.definition}
            </div>

            {/* Helper prompt text */}
            <p className="text-xs text-gray-400 italic">{def.placeholder}</p>

            <textarea
              value={localRole[field] || ''}
              onChange={e => handleFieldChange(field, e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent resize-y"
            />
          </div>
        )
      })}

      {/* Analyze button */}
      <div className="flex items-center gap-3 no-print">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="bg-[#C65911] hover:bg-[#a34a0e] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <span>&#10024;</span> Analyze This Role
            </>
          )}
        </button>
        <button
          onClick={handleDeleteClick}
          className={`text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
            confirmDelete
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'text-red-400 hover:text-red-600 hover:bg-red-50'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Remove Role'}
        </button>
      </div>

      {analyzeError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {analyzeError}
        </p>
      )}

      {/* AI Feedback */}
      <AIFeedbackPanel feedback={localRole.aiFeedback} lastAnalyzed={localRole.lastAnalyzed} />

      {/* Mentor comments */}
      {isMentorView && (
        <MentorComment
          section={`role:${role.id}`}
          menteeId={menteeId}
          comments={mentorComments}
          onAdd={onAddComment}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
        />
      )}
    </div>
  )
}
