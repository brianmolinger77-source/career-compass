import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getMentee, updateMentee, addRole, deleteRole, generateNarrative, evaluateJobPosting, checkAuth, analyzePSA, analyzeTargetRole, generateTargetRolePattern, deleteTargetRole, generateSessionPrep } from '../utils/api'
import RoleCard from '../components/RoleCard'
import VennDiagram from '../components/VennDiagram'
import PassionsStrengthsAspirations from '../components/PassionsStrengthsAspirations'
import TableStakes from '../components/TableStakes'
import NarrativeCard from '../components/NarrativeCard'
import PSAAnalysisPanel from '../components/PSAAnalysisPanel'
import ResumeBuilder from '../components/ResumeBuilder'
import { SaveStatusIndicator, useSaveStatus } from '../utils/autosave'

function calcCompletion(mentee) {
  const rolePoints = (mentee.roles || []).filter(r => r.whatIDid && r.howIDidIt && r.impact).length
  const sectionPoints =
    (mentee.passions ? 1 : 0) +
    (mentee.strengths ? 1 : 0) +
    (mentee.aspirations ? 1 : 0) +
    (mentee.tableStakes ? 1 : 0) +
    (mentee.generatedNarrative ? 1 : 0)
  const total = rolePoints + sectionPoints
  const max = Math.max(1, (mentee.roles || []).length) + 5
  return Math.round((total / max) * 100)
}

const TAB_LABELS = [
  'Career History',
  'My Story',
  'Passions & Strengths',
  'Resume',
  'Target Roles',
  'Job Eval',
]

export default function MenteeView() {
  const { menteeId } = useParams()
  const [mentee, setMentee] = useState(null)
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(null)
  const [isMentor, setIsMentor] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [narrativeMeta, setNarrativeMeta] = useState({ strength: '', refinement: '' })
  const [careerThread, setCareerThread] = useState('')
  const [showThreadPrompt, setShowThreadPrompt] = useState(false)
  const [psaAnalysis, setPSAAnalysis] = useState(null)
  const [isAnalyzingPSA, setIsAnalyzingPSA] = useState(false)
  const [psaError, setPSAError] = useState(null)
  const [jobPostingText, setJobPostingText] = useState('')
  const [jobAnalysis, setJobAnalysis] = useState(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [jobEvalError, setJobEvalError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [targetRoleInput, setTargetRoleInput] = useState('')
  const [targetRoleIndustry, setTargetRoleIndustry] = useState('')
  const [isAnalyzingTargetRole, setIsAnalyzingTargetRole] = useState(false)
  const [targetRoleError, setTargetRoleError] = useState(null)
  const [isGeneratingPattern, setIsGeneratingPattern] = useState(false)
  const [showSessionPrep, setShowSessionPrep] = useState(false)
  const [sessionPrepInput, setSessionPrepInput] = useState('')
  const [sessionPrepAgenda, setSessionPrepAgenda] = useState(null)
  const [sessionPrepNotes, setSessionPrepNotes] = useState('')
  const [isGeneratingSessionPrep, setIsGeneratingSessionPrep] = useState(false)
  const [sessionPrepError, setSessionPrepError] = useState(null)
  const { saveStatus, setSaving, setSaved, setError: setSaveError } = useSaveStatus()

  async function handleEvaluateJobPosting() {
    setIsEvaluating(true)
    setJobEvalError(null)
    setJobAnalysis(null)
    try {
      const result = await evaluateJobPosting(menteeId, jobPostingText)
      setJobAnalysis(result)
      setMentee(result.mentee)
    } catch (err) {
      if (err.message && err.message.includes('readiness_gate')) {
        setJobEvalError('readiness_gate')
      } else {
        setJobEvalError('To use this feature, complete at least one career history entry, all three PSA fields, and at least one table stake.')
      }
    } finally {
      setIsEvaluating(false)
    }
  }

  useEffect(() => {
    loadMentee()
  }, [menteeId])

  async function loadMentee() {
    try {
      const auth = await checkAuth()
      if (auth.authenticated) {
        setIsMentor(true)
        setPinVerified(true)
      }
      const data = await getMentee(menteeId)
      setMentee(data)
      setCareerThread(data.careerThread || '')
      setJobPostingText(data.savedJobPostingText || '')
      if (data.psaAnalysis) setPSAAnalysis(data.psaAnalysis)
        if (data.sessionPrepInput) setSessionPrepInput(data.sessionPrepInput)
        if (data.sessionPrepAgenda) setSessionPrepAgenda(data.sessionPrepAgenda)
        if (data.sessionPrepNotes) setSessionPrepNotes(data.sessionPrepNotes)
    } catch (err) {
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        setNotFound(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpdate(patch) {
    setSaving()
    try {
      const updated = await updateMentee(menteeId, patch)
      setMentee(updated)
      setSaved()
    } catch (err) {
      setSaveError()
    }
  }

  async function handleRoleUpdate(roleId, patch) {
    setSaving()
    try {
      const currentMentee = await getMentee(menteeId)
      const updatedRoles = (currentMentee.roles || []).map(r =>
        r.id === roleId ? { ...r, ...patch } : r
      )
      const updated = await updateMentee(menteeId, { roles: updatedRoles })
      setMentee(updated)
      setSaved()
    } catch (err) {
      setSaveError()
    }
  }

  async function handleAddRole() {
    try {
      const updated = await addRole(menteeId)
      setMentee(updated)
    } catch (err) {
      console.error('Failed to add role:', err)
    }
  }

  async function handleDeleteRole(roleId) {
    try {
      const updated = await deleteRole(menteeId, roleId)
      setMentee(updated)
    } catch (err) {
      console.error('Failed to delete role:', err)
    }
  }

  async function handleMoveRole(roleId, direction) {
    const roles = [...(mentee.roles || [])]
    const idx = roles.findIndex(r => r.id === roleId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= roles.length) return
    ;[roles[idx], roles[newIdx]] = [roles[newIdx], roles[idx]]
    setSaving()
    try {
      const updated = await updateMentee(menteeId, { roles })
      setMentee(updated)
      setSaved()
    } catch (err) {
      setSaveError()
    }
  }

  async function handleGenerateNarrative(skipThreadCheck = false) {
    if (!skipThreadCheck && !careerThread.trim()) {
      setShowThreadPrompt(true)
      return
    }
    setShowThreadPrompt(false)
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateNarrative(menteeId, careerThread)
      setMentee(result.mentee)
      setNarrativeMeta({
        strength: result.narrativeStrength,
        refinement: result.refinementNote
      })
      setActiveTab(1)
    } catch (err) {
      setGenerateError('Story generation unavailable right now — try again in a moment.')
    } finally {
      setIsGenerating(false)
    }
  }

  function handlePSAAnalysisComplete(analysis, updatedMentee) {
    setPSAAnalysis(analysis)
    if (updatedMentee) setMentee(updatedMentee)
  }

  async function handleAnalyzeTargetRole() {
    setIsAnalyzingTargetRole(true)
    setTargetRoleError(null)
    try {
      const result = await analyzeTargetRole(menteeId, targetRoleInput.trim(), targetRoleIndustry.trim())
      setMentee(result.mentee)
      if (result.updated) {
        setTargetRoleError(null)
      }
      setTargetRoleInput('')
      setTargetRoleIndustry('')
    } catch (err) {
      if (err.message && err.message.includes('readiness_gate')) {
        setTargetRoleError('Complete your Career History, PSA, and Table Stakes before using this feature.')
      } else {
        setTargetRoleError('Analysis unavailable right now — try again in a moment.')
      }
    } finally {
      setIsAnalyzingTargetRole(false)
    }
  }

  async function handleGeneratePattern() {
    setIsGeneratingPattern(true)
    try {
      const result = await generateTargetRolePattern(menteeId)
      setMentee(result.mentee)
    } catch (err) {
      console.error('Failed to generate pattern:', err)
    } finally {
      setIsGeneratingPattern(false)
    }
  }

  async function handleDeleteTargetRole(roleId) {
    try {
      const updated = await deleteTargetRole(menteeId, roleId)
      setMentee(updated)
    } catch (err) {
      console.error('Failed to delete target role:', err)
    }
  }

  async function handleAnalyzePSA() {
    setIsAnalyzingPSA(true)
    setPSAError(null)
    let lastErr
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await analyzePSA(mentee.id)
        handlePSAAnalysisComplete(result.analysis, result.mentee)
        setIsAnalyzingPSA(false)
        return
      } catch (err) {
        lastErr = err
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500))
      }
    }
    setPSAError('Analysis unavailable right now — try again in a moment.')
    setIsAnalyzingPSA(false)
  }

  async function handlePinSubmit() {
    setPinError(null)
    try {
      const res = await fetch('/api/mentee/' + menteeId + '/verify-pin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      })
      const data = await res.json()
      if (data.verified) {
        setPinVerified(true)
        loadMentee()
      } else {
        setPinError('Incorrect PIN. Check with your mentor.')
        setPinInput('')
      }
    } catch (err) {
      setPinError('Something went wrong. Try again in a moment.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading your Career Compass...</div>
      </div>
    )
  }

  if (notFound || !mentee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Document Not Found</h2>
          <p className="text-gray-500 text-sm mt-2">
            This Career Compass document doesn't exist. Check your link with your mentor.
          </p>
        </div>
      </div>
    )
  }

  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-[#1F4E79] mb-2">Enter Your PIN</h2>
          <p className="text-gray-500 text-sm mb-6">Your mentor provided a 6-digit PIN to access this page.</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && pinInput.length === 6 && handlePinSubmit()}
            placeholder="------"
            className="w-full text-center text-2xl tracking-widest border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
          />
          {pinError && <p className="text-red-500 text-sm mb-4">{pinError}</p>}
          <button
            onClick={handlePinSubmit}
            disabled={pinInput.length !== 6}
            className="w-full py-2.5 bg-[#1F4E79] text-white rounded-lg font-medium text-sm hover:bg-[#163d5e] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Access My Career Compass
          </button>
        </div>
      </div>
    )
  }

  if (!mentee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading your Career Compass...</div>
      </div>
    )
  }

  const roles = mentee.roles || []
  const completion = calcCompletion(mentee)
  const hasEnoughRoles = roles.length >= 2
  const rolesWithContent = roles.filter(r => r.whatIDid || r.howIDidIt || r.impact)
  const hasPSAContent = !!(mentee.passions || mentee.strengths || mentee.aspirations)
  const showResumeBuilder = rolesWithContent.length >= 2 && hasPSAContent

  const psaAndStakesComplete = !!(
    mentee.passions?.trim() &&
    mentee.strengths?.trim() &&
    mentee.aspirations?.trim() &&
    mentee.tableStakes?.trim()
  )

  const tabUnlocked = [
    true,
    roles.length >= 1,
    !!mentee.generatedNarrative,
    psaAndStakesComplete,
    psaAndStakesComplete,
    roles.length >= 1 && !!(mentee.passions?.trim() && mentee.strengths?.trim() && mentee.aspirations?.trim() && mentee.tableStakes?.trim()),
  ]

  const lockMessages = [
    '',
    'Add at least one role in Career History to unlock this.',
    'Generate your story in My Story to unlock this.',
    'Complete your Passions, Strengths, Aspirations, and Table Stakes to unlock this.',
    'Complete your Passions, Strengths, Aspirations, and Table Stakes to unlock this.',
    'Complete Career History and all PSA fields to unlock this.',
  ]

  function handleTabClick(idx) {
    if (tabUnlocked[idx]) {
      setActiveTab(idx)
    }
  }

  const completedTabs = tabUnlocked.map((unlocked, idx) => {
    if (idx === 0) return roles.length >= 1
    if (idx === 1) return !!mentee.generatedNarrative
    if (idx === 2) return psaAndStakesComplete && !!psaAnalysis
    if (idx === 3) return showResumeBuilder
    if (idx === 4) return false
    if (idx === 5) return !!jobAnalysis
    return false
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1F4E79] px-6 py-6 no-print">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Career Compass</h1>
              <p className="text-blue-200 text-sm mt-0.5">Your Military-to-Civilian Career Story</p>
              <p className="text-white font-semibold mt-2 text-lg">{mentee.name}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <SaveStatusIndicator status={saveStatus} />
              <button
                onClick={() => window.print()}
                className="text-sm text-blue-200 hover:text-white border border-blue-400 hover:border-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => setShowSessionPrep(!showSessionPrep)}
                disabled={!roles.length}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors border ${
                  roles.length
                    ? 'text-white border-white bg-blue-700 hover:bg-blue-600'
                    : 'text-blue-400 border-blue-700 cursor-not-allowed opacity-50'
                }`}
                title={!roles.length ? "Add at least one career role to use Session Prep" : ""}
              >
                {showSessionPrep ? "Close Session Prep" : "Prepare for My Session"}
              </button>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-blue-200">Document completion</span>
              <span className="text-xs font-semibold text-white">{completion}%</span>
            </div>
            <div className="w-full bg-blue-900 rounded-full h-2">
              <div
                className="bg-[#C65911] h-2 rounded-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky tab nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm no-print">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex overflow-x-auto">
              {TAB_LABELS.map((label, idx) => {
                const unlocked = tabUnlocked[idx]
                const completed = completedTabs[idx]
                const active = activeTab === idx
                return (
                  <button
                    key={idx}
                    onClick={() => handleTabClick(idx)}
                    className={`flex items-center gap-1.5 px-3 py-4 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                      active
                        ? 'border-[#1F4E79] text-[#1F4E79]'
                        : unlocked
                        ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        : 'border-transparent text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                      active
                        ? 'bg-[#1F4E79] text-white'
                        : completed
                        ? 'bg-green-500 text-white'
                        : unlocked
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-gray-100 text-gray-300'
                    }`}>
                      {completed && !active ? '✓' : idx + 1}
                    </span>
                    {label}
                  </button>
                )
              })}
          </div>
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="text-xs text-gray-400">Step {activeTab + 1} of 6</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1">
              <div
                className="bg-[#1F4E79] h-1 rounded-full transition-all"
                style={{ width: `${((activeTab + 1) / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Locked message */}
        {!tabUnlocked[activeTab] && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🔒</span>
            </div>
            <p className="text-gray-600 text-sm">{lockMessages[activeTab]}</p>
          </div>
        )}

        {/* Tab 0: Career History */}
        {activeTab === 0 && tabUnlocked[0] && (
          <div className="space-y-8">
            {roles.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">&#9881;</span>
                </div>
                <h2 className="text-xl font-bold text-[#1F4E79] mb-3">Welcome to Career Compass.</h2>
                <p className="text-gray-600 leading-relaxed max-w-xl mx-auto">
                  This document is yours — it's the foundation of your career story and everything we'll build together over the next year.
                  There are no wrong answers here. Write as if you're talking to a friend, not writing a report.
                  Your mentor will review this with you and help you shape it into something powerful.
                </p>
                <button
                  onClick={handleAddRole}
                  className="mt-6 bg-[#C65911] hover:bg-[#a34a0e] text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  Add Your First Role
                </button>
              </div>
            )}

            {roles.length > 0 && (
              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[#1F4E79]">Career History</h2>
                  <p className="text-gray-600 mt-2 leading-relaxed text-sm">
                    Start with your most recent role and work backwards. For each position, you'll answer three questions:
                    what you did, how you did it, and the impact you made. Don't worry about perfect language — your mentor
                    will help you refine it. Just tell the story honestly.
                  </p>
                </div>

                <div className="space-y-6">
                  {roles.map((role, idx) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      menteeId={menteeId}
                      onUpdate={handleRoleUpdate}
                      onDelete={handleDeleteRole}
                      onMoveUp={(id) => handleMoveRole(id, 'up')}
                      onMoveDown={(id) => handleMoveRole(id, 'down')}
                      isMentorView={false}
                      mentorComments={[]}
                      isFirst={idx === 0}
                      isLast={idx === roles.length - 1}
                    />
                  ))}
                </div>

                <div className="mt-6 flex justify-center no-print">
                  <button
                    onClick={handleAddRole}
                    className="border-2 border-dashed border-gray-300 hover:border-[#1F4E79] text-gray-500 hover:text-[#1F4E79] font-medium px-6 py-3 rounded-xl transition-colors text-sm"
                  >
                    + Add Another Role
                  </button>
                </div>

                {hasEnoughRoles && (
                  <>
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-3 my-6">
                      <div>
                        <h3 className="text-base font-bold text-[#1F4E79]">The Thread That Runs Through Your Career</h3>
                        <div className="mt-2 bg-blue-50 border-l-4 border-[#1F4E79] pl-3 py-2 rounded-r text-xs text-gray-700 leading-relaxed">
                          Before generating your narrative, take a moment to reflect. Looking across all the roles you've held, what's the one thing that has consistently shown up — something you've been drawn to, relied on, or that others have counted on you for? Don't overthink it. One or two sentences is enough.
                        </div>
                      </div>
                      <textarea
                        value={careerThread}
                        onChange={e => setCareerThread(e.target.value)}
                        onBlur={e => handleUpdate({ careerThread: e.target.value })}
                        placeholder="Across all my roles, the one consistent thread has been..."
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent resize-y"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-3 my-6 no-print">
                      {showThreadPrompt && !careerThread.trim() && (
                        <div className="w-full max-w-md bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-center space-y-3">
                          <p className="text-sm text-gray-700">
                            You can generate your story now, or take a moment to fill in the career thread above — it helps make the narrative sound more like you.
                          </p>
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => handleGenerateNarrative(true)}
                              className="text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors"
                            >
                              Generate Now
                            </button>
                            <button
                              onClick={() => setShowThreadPrompt(false)}
                              className="text-sm text-[#1F4E79] border border-[#1F4E79] hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                            >
                              Add My Thread First
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => handleGenerateNarrative(false)}
                        disabled={isGenerating || !hasEnoughRoles}
                        className="bg-[#C65911] hover:bg-[#a34a0e] text-white font-bold text-base px-8 py-3.5 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-3 shadow-md"
                      >
                        {isGenerating ? (
                          <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating Your Story...
                          </>
                        ) : (
                          <>
                            <span>&#10024;</span>
                            {mentee.generatedNarrative ? 'Regenerate My Story' : 'Generate My Story'}
                          </>
                        )}
                      </button>
                      {!hasEnoughRoles && (
                        <p className="text-xs text-gray-400">Add at least 2 roles to generate your story</p>
                      )}
                      {generateError && (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                          {generateError}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        )}

        {/* Tab 1: My Story */}
        {activeTab === 1 && tabUnlocked[1] && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1F4E79]">My Story</h2>
              <p className="text-gray-600 mt-2 leading-relaxed text-sm">
                This is your career narrative — a plain-language summary of who you are, what you've done, and what you bring to a civilian employer.
              </p>
            </div>
            {mentee.generatedNarrative ? (
              <NarrativeCard
                narrative={mentee.generatedNarrative}
                themes={mentee.themes || []}
                narrativeStrength={narrativeMeta.strength}
                refinementNote={narrativeMeta.refinement}
                narrativeGeneratedAt={mentee.narrativeGeneratedAt}
                onRegenerate={handleGenerateNarrative}
                isGenerating={isGenerating}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                <p className="text-gray-500 text-sm">Your story hasn't been generated yet. Go back to Career History and click Generate My Story.</p>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Passions & Strengths */}
        {activeTab === 2 && tabUnlocked[2] && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1F4E79]">Passions, Strengths & Aspirations</h2>
              <p className="text-gray-600 mt-2 leading-relaxed text-sm">
                This section is where your career story gets personal. The Venn diagram below maps the sweet spot
                where your passions, strengths, and aspirations converge. Fill in each section honestly —
                this will shape the narrative we build together.
              </p>
            </div>

            <div className="mb-8">
              <VennDiagram />
            </div>

            <div className="space-y-10">
              <PassionsStrengthsAspirations
                menteeData={mentee}
                onUpdate={handleUpdate}
                onPSAAnalysisComplete={handlePSAAnalysisComplete}
                isMentorView={false}
                showAnalyzeButton={false}
              />

              <TableStakes
                menteeData={mentee}
                onUpdate={handleUpdate}
                isMentorView={false}
              />

              {mentee.passions?.trim() && mentee.strengths?.trim() && mentee.aspirations?.trim() && (
                <div className="flex flex-col items-center gap-3 pt-2 no-print">
                  <button
                    onClick={handleAnalyzePSA}
                    disabled={isAnalyzingPSA}
                    className="bg-[#1F4E79] hover:bg-[#163d5e] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {isAnalyzingPSA ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>&#10022; Analyze My Passions, Strengths &amp; Aspirations</>
                    )}
                  </button>
                  {psaError && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {psaError}
                    </p>
                  )}
                </div>
              )}

              {psaAnalysis && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                  <PSAAnalysisPanel psaAnalysis={psaAnalysis} isMentorView={false} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab 3: Resume */}
        {activeTab === 3 && tabUnlocked[3] && (
          <section>
            {showResumeBuilder ? (
              <ResumeBuilder mentee={mentee} onUpdate={handleUpdate} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                <p className="text-gray-500 text-sm">Add at least 2 roles with content and complete your PSA to unlock the Resume Builder.</p>
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Target Roles */}
        {activeTab === 4 && tabUnlocked[4] && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1F4E79]">Target Roles</h2>
              <p className="text-gray-600 mt-2 leading-relaxed text-sm">
                Add roles you're interested in exploring. The AI will map your Career Compass profile against each role type — not a specific posting, but the category of work itself. Over time, patterns will emerge across the roles you're drawn to.
              </p>
            </div>

            {/* Input form */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job title <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={targetRoleInput}
                    onChange={e => setTargetRoleInput(e.target.value)}
                    placeholder="e.g. Project Manager, Operations Director, IT Program Manager"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company or industry <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={targetRoleIndustry}
                    onChange={e => setTargetRoleIndustry(e.target.value)}
                    placeholder="e.g. Healthcare, Financial Services, Lockheed Martin"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                </div>
                {targetRoleError && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{targetRoleError}</p>
                )}
                <button
                  onClick={handleAnalyzeTargetRole}
                  disabled={isAnalyzingTargetRole || !targetRoleInput.trim()}
                  className="bg-[#1F4E79] hover:bg-[#163d5e] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {isAnalyzingTargetRole ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>&#10022; Analyze This Role</>
                  )}
                </button>
              </div>
            </div>

            {/* Pattern callout — appears after 2+ roles saved */}
            {mentee.targetRoles && mentee.targetRoles.length >= 2 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[#1F4E79] mb-1">Pattern emerging across your target roles</h3>
                    {mentee.targetRolePattern ? (
                      <p className="text-sm text-gray-700 leading-relaxed">{mentee.targetRolePattern}</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Pattern not yet generated.</p>
                    )}
                  </div>
                  <button
                    onClick={handleGeneratePattern}
                    disabled={isGeneratingPattern}
                    className="shrink-0 text-xs text-[#1F4E79] border border-[#1F4E79] hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isGeneratingPattern ? 'Generating...' : mentee.targetRolePattern ? 'Refresh' : 'Generate Pattern'}
                  </button>
                </div>
              </div>
            )}

            {/* Saved roles list */}
            {mentee.targetRoles && mentee.targetRoles.length > 0 && (
              <div className="space-y-6">
                {mentee.targetRoles.map(role => (
                  <div key={role.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-[#1F4E79]">{role.jobTitle}</h3>
                        {role.companyOrIndustry && (
                          <p className="text-sm text-gray-500 mt-0.5">{role.companyOrIndustry}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteTargetRole(role.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-xl font-medium text-green-700">{role.aligns?.length || 0}</div>
                        <div className="text-xs text-green-600 mt-0.5">lines up</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xl font-medium text-gray-700">{role.differences?.length || 0}</div>
                        <div className="text-xs text-gray-500 mt-0.5">heads up</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xl font-medium text-gray-700">{role.unknowns?.length || 0}</div>
                        <div className="text-xs text-gray-500 mt-0.5">questions to ask</div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3">
                        <div className="text-xl font-medium text-amber-700">{role.conflicts?.length || 0}</div>
                        <div className="text-xs text-amber-600 mt-0.5">worth a conversation</div>
                      </div>
                    </div>

                    {/* Aligns chips */}
                    {role.aligns && role.aligns.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Where it lines up</p>
                        <p className="text-xs text-gray-400 mb-2">Hover over any item to see detail.</p>
                        <div className="flex flex-wrap gap-2">
                          {role.aligns.map((item, i) => {
                            const label = typeof item === 'object' ? item.label : item
                            const detail = typeof item === 'object' ? item.detail : item
                            return (
                              <div key={i} className="relative group">
                                <span className="inline-block text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full cursor-default">
                                  {label}
                                </span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600 leading-relaxed z-10 pointer-events-none shadow-sm">
                                  {detail}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Conflicts */}
                    {role.conflicts && role.conflicts.length > 0 && (
                      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-xs font-medium text-amber-700 mb-2">Worth a conversation</p>
                        <div className="space-y-3">
                          {role.conflicts.map((item, i) => (
                            <div key={i}>
                              <p className="text-sm text-gray-700">{item.observation}</p>
                              {item.reflectingQuestion && (
                                <p className="mt-1 text-sm text-amber-700 italic">{item.reflectingQuestion}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Differences */}
                    {role.differences && role.differences.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Heads up</p>
                        <div className="space-y-1">
                          {role.differences.map((item, i) => (
                            <p key={i} className="text-sm text-gray-500 pl-3 border-l-2 border-gray-200">{item}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unknowns */}
                    {role.unknowns && role.unknowns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Questions worth asking</p>
                        <div className="space-y-1">
                          {role.unknowns.map((item, i) => (
                            <p key={i} className="text-sm text-gray-500 pl-3 border-l-2 border-gray-200">{item}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-4">This analysis is based on what's captured in your Career Compass profile. It's a starting point for reflection, not a recommendation.</p>
                  </div>
                ))}
              </div>
            )}

            {(!mentee.targetRoles || mentee.targetRoles.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No target roles added yet. Use the form above to explore roles you're interested in.</p>
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Job Evaluation */}
        {activeTab === 5 && tabUnlocked[5] && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1F4E79]">Evaluate a Job Posting</h2>
              <p className="text-gray-600 mt-2 leading-relaxed text-sm">
                Paste a job description below. The AI will compare it against your Career Compass profile and show you where things align, where there are gaps, and where there may be tension with what matters most to you.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-700 h-48 resize-y focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                placeholder="Paste the job description here..."
                value={jobPostingText}
                onChange={e => setJobPostingText(e.target.value)}
                onBlur={e => handleUpdate({ savedJobPostingText: e.target.value })}
              />
              {jobEvalError === 'readiness_gate' && (
                <p className="text-amber-600 text-sm mt-3">
                  To use this feature, complete at least one career history entry, all three PSA fields (Passions, Strengths, and Aspirations), and at least one table stake.
                </p>
              )}
              {jobEvalError && jobEvalError !== 'readiness_gate' && (
                <p className="text-red-500 text-sm mt-3">{jobEvalError}</p>
              )}
              <button
                onClick={handleEvaluateJobPosting}
                disabled={isEvaluating || !jobPostingText.trim()}
                className="mt-4 px-6 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#163d5e] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEvaluating ? 'Analyzing...' : 'Evaluate This Role'}
              </button>
            </div>

            {jobAnalysis && (
              <div className="mt-8 space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xl font-medium text-green-700">{jobAnalysis.aligns?.length || 0}</div>
                    <div className="text-xs text-green-600 mt-0.5">lines up</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xl font-medium text-gray-700">{jobAnalysis.differences?.length || 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">heads up</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xl font-medium text-gray-700">{jobAnalysis.unknowns?.length || 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">questions to ask</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="text-xl font-medium text-amber-700">{jobAnalysis.conflicts?.length || 0}</div>
                    <div className="text-xs text-amber-600 mt-0.5">worth a conversation</div>
                  </div>
                </div>

                {jobAnalysis.conflicts && jobAnalysis.conflicts.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-amber-700 mb-3">Worth a conversation</h3>
                    <div className="space-y-3">
                      {jobAnalysis.conflicts.map((item, i) => (
                        <div key={i}>
                          <p className="text-sm text-gray-700">{item.observation}</p>
                          {item.reflectingQuestion && (
                            <p className="mt-1.5 text-sm text-amber-700 italic">{item.reflectingQuestion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {jobAnalysis.aligns && jobAnalysis.aligns.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">Where it lines up</h3>
                    <p className="text-xs text-gray-400 mb-3">Hover over any item to see detail.</p>
                    <div className="flex flex-wrap gap-2">
                      {jobAnalysis.aligns.map((item, i) => {
                        const label = typeof item === 'object' ? item.label : item
                        const detail = typeof item === 'object' ? item.detail : item
                        return (
                          <div key={i} className="relative group">
                            <span className="inline-block text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full cursor-default">
                              {label}
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600 leading-relaxed z-10 pointer-events-none shadow-sm">
                              {detail}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {jobAnalysis.differences && jobAnalysis.differences.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">Heads up</h3>
                    <div className="space-y-2">
                      {jobAnalysis.differences.map((item, i) => (
                        <p key={i} className="text-sm text-gray-500 pl-3 border-l-2 border-gray-200">{item}</p>
                      ))}
                    </div>
                  </div>
                )}

                {jobAnalysis.unknowns && jobAnalysis.unknowns.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">Questions worth asking</h3>
                    <div className="space-y-2">
                      {jobAnalysis.unknowns.map((item, i) => (
                        <p key={i} className="text-sm text-gray-500 pl-3 border-l-2 border-gray-200">{item}</p>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 text-center pt-2">
                  This analysis is based on what's captured in your Career Compass profile. It's a starting point for reflection, not a recommendation.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Session Prep Panel */}
        {showSessionPrep && (
          <div className="max-w-3xl mx-auto px-4 pb-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-[#1F4E79] mb-1">Prepare for My Session</h2>
              <p className="text-sm text-gray-500 mb-5">Write freely about what's on your mind — what feels unresolved, what's changed, what you want help with. The AI will shape it into a structured 60-minute focus plan.</p>

              <textarea
                value={sessionPrepInput}
                onChange={e => setSessionPrepInput(e.target.value)}
                onBlur={async () => {
                  if (sessionPrepInput !== (mentee.sessionPrepInput || '')) {
                    setSaving()
                    try {
                      const updated = await updateMentee(menteeId, { sessionPrepInput })
                      setMentee(updated)
                      setSaved()
                    } catch { setSaveError() }
                  }
                }}
                placeholder="What's on your mind going into your next session?"
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 mb-4"
              />

              <button
                onClick={async () => {
                  setIsGeneratingSessionPrep(true)
                  setSessionPrepError(null)
                  try {
                    const result = await generateSessionPrep(menteeId, sessionPrepInput)
                    setSessionPrepAgenda(result.agenda)
                    setMentee(result.mentee)
                  } catch (err) {
                    setSessionPrepError("Session prep unavailable right now — try again in a moment.")
                  } finally {
                    setIsGeneratingSessionPrep(false)
                  }
                }}
                disabled={isGeneratingSessionPrep}
                className="bg-[#1F4E79] text-white text-sm px-5 py-2.5 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 mb-6"
              >
                {isGeneratingSessionPrep ? "Building your session plan..." : "Generate Session Plan"}
              </button>

              {sessionPrepError && (
                <p className="text-red-500 text-sm mb-4">{sessionPrepError}</p>
              )}

              {sessionPrepAgenda && (
                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-[#1F4E79] mb-1">Session goal</p>
                    <p className="text-sm text-gray-700">{sessionPrepAgenda.sessionGoal}</p>
                  </div>
                  <div className="space-y-3">
                    {(sessionPrepAgenda.agendaItems || []).map((item, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{item.minutes} min</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">{item.prepNote}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-2">Total: {sessionPrepAgenda.totalMinutes} minutes</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Key takeaways and next steps</label>
                <p className="text-xs text-gray-400 mb-3">After your session, capture what you decided and what you're doing next.</p>
                <textarea
                  value={sessionPrepNotes}
                  onChange={e => setSessionPrepNotes(e.target.value)}
                  onBlur={async () => {
                    if (sessionPrepNotes !== (mentee.sessionPrepNotes || '')) {
                      setSaving()
                      try {
                        const updated = await updateMentee(menteeId, { sessionPrepNotes })
                        setMentee(updated)
                        setSaved()
                      } catch { setSaveError() }
                    }
                  }}
                  placeholder="What did you decide? What are you doing next?"
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pb-12 text-center mt-8">
          <p className="text-xs text-gray-300">Career Compass &mdash; {mentee.name}</p>
        </div>
      </div>
    </div>
  )
}
