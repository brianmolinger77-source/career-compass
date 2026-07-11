import React, { useState, useRef, useCallback, useEffect } from 'react'
import AIFeedbackPanel from './AIFeedbackPanel'
import MentorComment from './MentorComment'
import { analyzeRole } from '../utils/api'

const OUTCOME_WORDS = /\b(improved|reduced|saved|built|increased|decreased|delivered|cut|grew|launched)\b/i
const QUANTIFIER = /[\d%$]|\b(millions?|billions?|thousands?|hundreds?|dozens?)\b/i

function evaluateImpact(text) {
  if (!text) return false
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length
  return QUANTIFIER.test(text) && OUTCOME_WORDS.test(text) && wordCount >= 30
}

const WHAT_I_DID_SCALE = /\d|\b(team|budget|responsible|managed|led|oversaw|supported|personnel|soldiers|sailors|airmen|staff|reports)\b/i

function evaluateWhatIDid(text) {
  if (!text) return false
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length
  return WHAT_I_DID_SCALE.test(text) && wordCount >= 30
}

const HOW_I_DID_IT_JUDGMENT = /\b(decided|chose|prioritized|asked|listened|considered|recognized|realized|noticed|assessed|evaluated|determined|approached|communicated|understood|identified|questioned|balanced)\b/i

function evaluateHowIDidIt(text) {
  if (!text) return false
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length
  return HOW_I_DID_IT_JUDGMENT.test(text) && wordCount >= 30
}

const RETRY_DELAYS_MS = [1000, 2000, 4000]

// Per-field save status shown next to a single input/textarea. Deliberately quiet on
// the happy path (the shared header already pulses "Saving.../Saved" for that) — this
// only speaks up once a save is actually in trouble, and never claims to be "retrying"
// once it has genuinely stopped.
function FieldSaveStatus({ state, onRetry }) {
  if (!state) return null
  if (state.status === 'retrying') {
    const label = state.manual
      ? 'Retrying…'
      : `Save failed — retrying (${state.attempt - 1} of ${RETRY_DELAYS_MS.length})…`
    return <p className="text-xs text-amber-600 mt-1">{label}</p>
  }
  if (state.status === 'error') {
    return (
      <p className="text-xs text-red-600 mt-1 flex items-center gap-2">
        <span>Save failed. Your last change here wasn't saved.</span>
        <button
          type="button"
          onClick={onRetry}
          className="underline font-medium hover:text-red-700 flex-shrink-0"
        >
          Retry
        </button>
      </p>
    )
  }
  return null
}

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
  onEmergencyFlush,
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
  const [hasEditedSinceAnalysis, setHasEditedSinceAnalysis] = useState(false)
  const [impactQualityState, setImpactQualityState] = useState(() => {
    const impact = role.impact || ''
    if (!impact.trim()) return 'unstarted'
    return evaluateImpact(impact) ? 'complete' : 'in-progress'
  })
  const [whatIDidQualityState, setWhatIDidQualityState] = useState(() => {
    const whatIDid = role.whatIDid || ''
    if (!whatIDid.trim()) return 'unstarted'
    return evaluateWhatIDid(whatIDid) ? 'complete' : 'in-progress'
  })
  const [howIDidItQualityState, setHowIDidItQualityState] = useState(() => {
    const howIDidIt = role.howIDidIt || ''
    if (!howIDidIt.trim()) return 'unstarted'
    return evaluateHowIDidIt(howIDidIt) ? 'complete' : 'in-progress'
  })
  // Per-field save bookkeeping, keyed by field: { [field]: { patch, debounceTimerId, retryTimerId } }.
  // An entry exists here for as long as a field's latest edit is NOT yet confirmed saved —
  // whether it's still waiting out the debounce, actively in flight, or waiting between
  // retries. That's what lets both flush paths below find and send un-saved data at any
  // point in a save's lifecycle, not just during the initial debounce window.
  const fieldState = useRef({})
  // Per-field UI status, shown only once a save is in trouble (retrying or failed) — the
  // shared header already handles the "Saving.../Saved" happy path, so this stays quiet
  // otherwise. Tracking failures here instead of on the shared header is what stops one
  // field's failure from being erased by a different field's unrelated success.
  const [fieldStatuses, setFieldStatuses] = useState({})
  const latestOnUpdate = useRef(onUpdate)
  const latestOnEmergencyFlush = useRef(onEmergencyFlush)
  const isMountedRef = useRef(true)
  useEffect(() => {
    latestOnUpdate.current = onUpdate
    latestOnEmergencyFlush.current = onEmergencyFlush
  })
  useEffect(() => {
    // Reset to true on (re-)mount, not just on the initial useRef(true) — React
    // StrictMode double-invokes this effect in dev (mount, cleanup, mount again) to
    // surface exactly this kind of bug, and without resetting here the ref would be
    // stuck false after that dance even though the component is genuinely still alive.
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  function clearFieldStatus(field) {
    setFieldStatuses(prev => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  // Attempts to save a single field's pending patch, retrying up to RETRY_DELAYS_MS.length
  // times with increasing delay on failure. `attempt` is 1 for the first, automatic try;
  // isManual marks a save re-triggered from the "Retry" button after all attempts failed.
  function attemptSave(field, attempt, isManual = false) {
    const entry = fieldState.current[field]
    if (!entry) return

    if (attempt > 1 || isManual) {
      setFieldStatuses(prev => ({ ...prev, [field]: { status: 'retrying', attempt, manual: isManual && attempt === 1 } }))
    } else {
      clearFieldStatus(field)
    }

    latestOnUpdate.current(role.id, entry.patch)
      .then(() => {
        if (!isMountedRef.current) return
        const current = fieldState.current[field]
        // Only clear if this attempt's patch is still the latest — a newer edit may have
        // superseded it while this request was in flight.
        if (current && current.patch === entry.patch) {
          delete fieldState.current[field]
          clearFieldStatus(field)
        }
      })
      .catch(() => {
        if (!isMountedRef.current) return
        const current = fieldState.current[field]
        // Bail if superseded by a newer edit, or already handed off to the close-flush path.
        if (!current || current.patch !== entry.patch) return

        if (attempt > RETRY_DELAYS_MS.length) {
          setFieldStatuses(prev => ({ ...prev, [field]: { status: 'error', attempt } }))
          return
        }
        const delay = RETRY_DELAYS_MS[attempt - 1]
        setFieldStatuses(prev => ({ ...prev, [field]: { status: 'retrying', attempt: attempt + 1 } }))
        current.retryTimerId = setTimeout(() => attemptSave(field, attempt + 1), delay)
      })
  }

  function handleManualRetry(field) {
    const entry = fieldState.current[field]
    if (!entry) return
    if (entry.retryTimerId) clearTimeout(entry.retryTimerId)
    attemptSave(field, 1, true)
  }

  // In-app unmount (switching tabs, switching mentees, removing this role): the app is
  // still alive, so fire one normal-path save per pending field and let it complete —
  // no retry loop here, since there would be nowhere left to show it if it failed again.
  useEffect(() => {
    return () => {
      const fields = Object.keys(fieldState.current)
      if (fields.length === 0) return
      const mergedPatch = {}
      for (const field of fields) {
        const entry = fieldState.current[field]
        clearTimeout(entry.debounceTimerId)
        clearTimeout(entry.retryTimerId)
        Object.assign(mergedPatch, entry.patch)
        delete fieldState.current[field]
      }
      latestOnUpdate.current(role.id, mergedPatch)
        .catch(err => console.error('Failed to flush pending role edit on navigation:', err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.id])

  // Real page teardown (tab closed, backgrounded, reloaded): the app may not survive long
  // enough for a normal fetch to complete, so flush with a keepalive request instead.
  // pagehide/visibilitychange are used instead of beforeunload because mobile browsers are
  // inconsistent about firing beforeunload when a tab is backgrounded rather than closed.
  useEffect(() => {
    function flushForClose() {
      const fields = Object.keys(fieldState.current)
      if (fields.length === 0) return
      const patchesByField = {}
      const mergedPatch = {}
      for (const field of fields) {
        const entry = fieldState.current[field]
        clearTimeout(entry.debounceTimerId)
        clearTimeout(entry.retryTimerId)
        patchesByField[field] = entry.patch
        Object.assign(mergedPatch, entry.patch)
        delete fieldState.current[field]
      }
      latestOnEmergencyFlush.current(role.id, mergedPatch)
        .catch(() => {
          // The keepalive flush itself failed — if we're still here to see that, the page
          // survived after all, so don't lose the edit: fall back into the normal
          // per-field retry path instead of just giving up silently.
          for (const field of fields) {
            fieldState.current[field] = { patch: patchesByField[field], debounceTimerId: null, retryTimerId: null }
            attemptSave(field, 1)
          }
        })
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushForClose()
      }
    }
    window.addEventListener('pagehide', flushForClose)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushForClose)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.id])

  function handleFieldChange(field, value) {
    // If there's existing feedback and the user is editing, mark revisions as pending
    const hadFeedback = !!localRole.aiFeedback
    const patch = { [field]: value }
    if (hadFeedback && !hasEditedSinceAnalysis) {
      setHasEditedSinceAnalysis(true)
      patch.revisedAfterFeedback = false
    }
    const updated = { ...localRole, ...patch }
    setLocalRole(updated)

    if (field === 'impact') {
      setImpactQualityState(prev => (prev === 'unstarted' || prev === 'complete') ? 'in-progress' : prev)
    }
    if (field === 'whatIDid') {
      setWhatIDidQualityState(prev => (prev === 'unstarted' || prev === 'complete') ? 'in-progress' : prev)
    }
    if (field === 'howIDidIt') {
      setHowIDidItQualityState(prev => (prev === 'unstarted' || prev === 'complete') ? 'in-progress' : prev)
    }

    // A fresh edit clears any stale retry/error indicator for this field. An older in-flight
    // attempt may still resolve, but attemptSave's patch-identity check discards it once
    // superseded, so it can't stomp this newer edit's own status.
    clearFieldStatus(field)

    const existing = fieldState.current[field]
    if (existing) {
      clearTimeout(existing.debounceTimerId)
      clearTimeout(existing.retryTimerId)
    }
    const debounceTimerId = setTimeout(() => {
      fieldState.current[field].debounceTimerId = null
      attemptSave(field, 1)
    }, 1500)
    fieldState.current[field] = { patch, debounceTimerId, retryTimerId: null }
  }

  function handleImpactBlur(value) {
    const text = value || ''
    if (!text.trim()) {
      setImpactQualityState('unstarted')
    } else if (evaluateImpact(text)) {
      setImpactQualityState('complete')
    }
  }

  function handleWhatIDidBlur(value) {
    const text = value || ''
    if (!text.trim()) {
      setWhatIDidQualityState('unstarted')
    } else if (evaluateWhatIDid(text)) {
      setWhatIDidQualityState('complete')
    }
  }

  function handleHowIDidItBlur(value) {
    const text = value || ''
    if (!text.trim()) {
      setHowIDidItQualityState('unstarted')
    } else if (evaluateHowIDidIt(text)) {
      setHowIDidItQualityState('complete')
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true)
    setAnalyzeError(null)
    const isRevision = hasEditedSinceAnalysis
    let lastErr
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await analyzeRole(
          menteeId,
          role.id,
          localRole.whatIDid,
          localRole.howIDidIt,
          localRole.impact,
          isRevision
        )
        const revisedAfterFeedback = isRevision
        setLocalRole(prev => ({
          ...prev,
          aiFeedback: result.feedback,
          lastAnalyzed: new Date().toISOString(),
          revisedAfterFeedback
        }))
        setHasEditedSinceAnalysis(false)
        setIsAnalyzing(false)
        return
      } catch (err) {
        lastErr = err
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500))
      }
    }
    setAnalyzeError('Analysis unavailable right now — try again in a moment. Your content has been saved.')
    setIsAnalyzing(false)
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete(role.id)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
    }
  }

  // Revision status derived from local state
  const revisionStatus = !localRole.aiFeedback
    ? null
    : localRole.revisedAfterFeedback
      ? 'revised'
      : 'pending'

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      {/* Revision status indicator */}
      {revisionStatus === 'pending' && (
        <div className="flex items-center gap-2 no-print">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-medium">Feedback received — revisions pending</span>
        </div>
      )}
      {revisionStatus === 'revised' && (
        <div className="flex items-center gap-2 no-print">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-xs text-green-700 font-medium">Revised and re-analyzed</span>
        </div>
      )}

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
            <FieldSaveStatus state={fieldStatuses.title} onRetry={() => handleManualRetry('title')} />
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
            <FieldSaveStatus state={fieldStatuses.organization} onRetry={() => handleManualRetry('organization')} />
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
          <FieldSaveStatus state={fieldStatuses.startYear} onRetry={() => handleManualRetry('startYear')} />
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
          <FieldSaveStatus state={fieldStatuses.endYear} onRetry={() => handleManualRetry('endYear')} />
        </div>
      </div>

      {/* Three text areas */}
      {['whatIDid', 'howIDidIt', 'impact'].map(field => {
        const def = FIELD_DEFINITIONS[field]
        const isImpact = field === 'impact'
        const isWhatIDid = field === 'whatIDid'
        const isHowIDidIt = field === 'howIDidIt'
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

            {/* How I Did It quality bar */}
            {isHowIDidIt && (
              <>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out no-print ${
                  howIDidItQualityState === 'complete' ? 'max-h-0 opacity-0' : 'max-h-48 opacity-100'
                }`}>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                    This field tells a hiring manager who you are, not just what you did. When they ask how you handled a difficult situation, they're not checking a box — they're learning how you think, how you communicate, and how you treat people. Did you consider their perspective before acting? What questions did you ask? What did you decide and why?
                  </p>
                </div>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out no-print ${
                  howIDidItQualityState === 'complete' ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    A hiring manager is starting to see how you think.
                  </p>
                </div>
              </>
            )}

            {/* What I Did quality bar */}
            {isWhatIDid && (
              <>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out no-print ${
                  whatIDidQualityState === 'complete' ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'
                }`}>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                    Think scope and scale, not job duties. Any hiring manager can read a job description. What they can't read anywhere else is the size of what you were responsible for — how many people, how much budget, how large a geographic footprint, how consequential the mission. Lead with that.
                  </p>
                </div>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out no-print ${
                  whatIDidQualityState === 'complete' ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    A hiring manager can see the size of what you carried.
                  </p>
                </div>
              </>
            )}

            {/* Impact quality bar */}
            {isImpact && (
              <>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out no-print ${
                  impactQualityState === 'complete' ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'
                }`}>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                    Most candidates never connect what they did to what changed — and closing that gap is where you become memorable. A hiring manager who can picture the scale of your work and its result starts to see you as a real person, not a resume. Specific numbers, even honest estimates, make that picture vivid.
                  </p>
                </div>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out no-print ${
                  impactQualityState === 'complete' ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    This gives a hiring manager something to picture.
                  </p>
                </div>
              </>
            )}

            <textarea
              value={localRole[field] || ''}
              onChange={e => handleFieldChange(field, e.target.value)}
              onBlur={
                isImpact ? e => handleImpactBlur(e.target.value) :
                isWhatIDid ? e => handleWhatIDidBlur(e.target.value) :
                isHowIDidIt ? e => handleHowIDidItBlur(e.target.value) :
                undefined
              }
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent resize-y"
            />
            <FieldSaveStatus state={fieldStatuses[field]} onRetry={() => handleManualRetry(field)} />
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
              <span>&#10024;</span>
              {localRole.aiFeedback ? "I've Revised This — Re-Analyze" : 'Analyze This Role'}
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
