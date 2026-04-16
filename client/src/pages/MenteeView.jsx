import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getMentee, updateMentee, addRole, deleteRole, generateNarrative } from '../utils/api'
import RoleCard from '../components/RoleCard'
import VennDiagram from '../components/VennDiagram'
import PassionsStrengthsAspirations from '../components/PassionsStrengthsAspirations'
import TableStakes from '../components/TableStakes'
import NarrativeCard from '../components/NarrativeCard'
import PSAAnalysisPanel from '../components/PSAAnalysisPanel'
import { SaveStatusIndicator, useSaveStatus } from '../utils/autosave'

function calcCompletion(mentee) {
  const roles = mentee.roles || []
  const rolePoints = roles.filter(r => r.whatIDid && r.howIDidIt && r.impact).length
  const sectionPoints =
    (mentee.passions ? 1 : 0) +
    (mentee.strengths ? 1 : 0) +
    (mentee.aspirations ? 1 : 0) +
    (mentee.tableStakes ? 1 : 0) +
    (mentee.generatedNarrative ? 1 : 0)
  const total = rolePoints + sectionPoints
  const max = Math.max(1, roles.length) + 5
  return Math.round((total / max) * 100)
}

export default function MenteeView() {
  const { menteeId } = useParams()
  const [mentee, setMentee] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [narrativeMeta, setNarrativeMeta] = useState({ strength: '', refinement: '' })
  const [careerThread, setCareerThread] = useState('')
  const [showThreadPrompt, setShowThreadPrompt] = useState(false)
  const [psaAnalysis, setPSAAnalysis] = useState(null)
  const { saveStatus, setSaving, setSaved, setError: setSaveError } = useSaveStatus()

  useEffect(() => {
    loadMentee()
  }, [menteeId])

  async function loadMentee() {
    try {
      const data = await getMentee(menteeId)
      setMentee(data)
      setCareerThread(data.careerThread || '')
      if (data.psaAnalysis) setPSAAnalysis(data.psaAnalysis)
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
    // If careerThread is empty, show prompt first
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

  const roles = mentee.roles || []
  const completion = calcCompletion(mentee)
  const hasEnoughRoles = roles.length >= 2

  const CareerThreadField = () => (
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
        placeholder="Across all my roles, the one consistent thread has been..."
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent resize-y"
      />
    </div>
  )

  const GenerateButton = () => (
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
  )

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
            </div>
          </div>

          {/* Progress bar */}
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

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-12">

        {/* Onboarding / Empty state */}
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

        {/* Career History Section */}
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
                <CareerThreadField />
                <GenerateButton />
              </>
            )}
          </section>
        )}

        {/* Passions, Strengths, Aspirations & Table Stakes */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1F4E79]">
              Passions, Strengths & Aspirations
            </h2>
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
            />

            <TableStakes
              menteeData={mentee}
              onUpdate={handleUpdate}
              isMentorView={false}
            />

            {psaAnalysis && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <PSAAnalysisPanel psaAnalysis={psaAnalysis} isMentorView={false} />
              </div>
            )}
          </div>
        </section>

        {/* Career thread + Generate button at bottom of document */}
        {roles.length > 0 && (
          <>
            <CareerThreadField />
            <GenerateButton />
          </>
        )}

        {/* Narrative */}
        {mentee.generatedNarrative && (
          <section>
            <NarrativeCard
              narrative={mentee.generatedNarrative}
              themes={mentee.themes || []}
              narrativeStrength={narrativeMeta.strength}
              refinementNote={narrativeMeta.refinement}
              narrativeGeneratedAt={mentee.narrativeGeneratedAt}
              onRegenerate={handleGenerateNarrative}
              isGenerating={isGenerating}
            />
          </section>
        )}

        <div className="pb-12 text-center">
          <p className="text-xs text-gray-300">Career Compass &mdash; {mentee.name}</p>
        </div>
      </div>
    </div>
  )
}
