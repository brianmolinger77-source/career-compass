import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getMentee, updateMentee, addRole, deleteRole, generateNarrative, addComment, updateComment, deleteComment } from '../utils/api'
import RoleCard from '../components/RoleCard'
import VennDiagram from '../components/VennDiagram'
import PassionsStrengthsAspirations from '../components/PassionsStrengthsAspirations'
import TableStakes from '../components/TableStakes'
import NarrativeCard from '../components/NarrativeCard'
import ThemesPanel from '../components/ThemesPanel'
import MentorComment from '../components/MentorComment'
import PSAAnalysisPanel from '../components/PSAAnalysisPanel'
import { analyzePSA } from '../utils/api'
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

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

const SECTION_LABELS = {
  passions: 'Passions',
  strengths: 'Strengths',
  aspirations: 'Aspirations',
  tableStakes: 'Table Stakes',
  narrative: 'Career Narrative'
}

function getSectionLabel(section) {
  if (section.startsWith('role:')) return 'Role Entry'
  return SECTION_LABELS[section] || section
}

export default function MentorMenteeView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [mentee, setMentee] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [narrativeMeta, setNarrativeMeta] = useState({ strength: '', refinement: '' })
  const [psaAnalysis, setPSAAnalysis] = useState(null)
  const [isAnalyzingPSA, setIsAnalyzingPSA] = useState(false)
  const { saveStatus, setSaving, setSaved, setError: setSaveError } = useSaveStatus()

  useEffect(() => {
    loadMentee()
  }, [id])

  async function loadMentee() {
    try {
      const data = await getMentee(id)
      setMentee(data)
      if (data.psaAnalysis) setPSAAnalysis(data.psaAnalysis)
    } catch (err) {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReAnalyzePSA() {
    setIsAnalyzingPSA(true)
    try {
      const result = await analyzePSA(id)
      setPSAAnalysis(result.analysis)
      if (result.mentee) setMentee(result.mentee)
    } catch (err) {
      console.error('PSA re-analysis failed:', err)
    } finally {
      setIsAnalyzingPSA(false)
    }
  }

  function handlePSAAnalysisComplete(analysis, updatedMentee) {
    setPSAAnalysis(analysis)
    if (updatedMentee) setMentee(updatedMentee)
  }

  async function handleUpdate(patch) {
    setSaving()
    try {
      const updated = await updateMentee(id, patch)
      setMentee(updated)
      setSaved()
    } catch (err) {
      setSaveError()
    }
  }

  // Deliberately no try/catch here — on failure this rejects and propagates to the
  // caller (RoleCard), which owns per-field retry/error UI for role fields. We still
  // pulse the shared header optimistically on the way in/out, but we never call
  // setSaveError() for this path, so a failing field's error can't later be silently
  // erased by an unrelated successful save elsewhere on the page.
  async function handleRoleUpdate(roleId, patch) {
    setSaving()
    const currentMentee = await getMentee(id)
    const updatedRoles = (currentMentee.roles || []).map(r =>
      r.id === roleId ? { ...r, ...patch } : r
    )
    const updated = await updateMentee(id, { roles: updatedRoles })
    setMentee(updated)
    setSaved()
    return updated
  }

  async function handleAddRole() {
    setSaving()
    try {
      const updated = await addRole(id)
      setMentee(updated)
      setSaved()
    } catch (err) {
      console.error('Failed to add role:', err)
      setSaveError()
    }
  }

  // Fire-and-forget flush for real page teardown (tab close/background), where we
  // can't wait for a normal request to complete. Merges the patch into the last-known
  // roles array and sends a single keepalive PUT instead of the usual GET-then-PUT.
  // Returns the promise (rather than swallowing errors) so RoleCard can fall back to
  // its normal per-field retry path if the keepalive request itself fails.
  function handleRoleEmergencyFlush(roleId, patch) {
    const updatedRoles = (mentee.roles || []).map(r =>
      r.id === roleId ? { ...r, ...patch } : r
    )
    setSaving()
    return updateMentee(id, { roles: updatedRoles }, { keepalive: true })
      .then(updated => {
        setMentee(updated)
        setSaved()
        return updated
      })
  }

  async function handleDeleteRole(roleId) {
    try {
      const updated = await deleteRole(id, roleId)
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
      const updated = await updateMentee(id, { roles })
      setMentee(updated)
      setSaved()
    } catch (err) {
      setSaveError()
    }
  }

  async function handleGenerateNarrative() {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateNarrative(id)
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

  async function handleAddComment(section, comment) {
    const updated = await addComment(id, section, comment)
    setMentee(updated)
  }

  async function handleUpdateComment(commentId, comment) {
    const updated = await updateComment(id, commentId, comment)
    setMentee(updated)
  }

  async function handleDeleteComment(commentId) {
    const updated = await deleteComment(id, commentId)
    setMentee(updated)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading mentee document...</div>
      </div>
    )
  }

  if (notFound || !mentee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Mentee Not Found</h2>
          <Link to="/mentor" className="text-[#1F4E79] hover:underline text-sm mt-3 block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const roles = mentee.roles || []
  const mentorComments = mentee.mentorComments || []
  const completion = calcCompletion(mentee)
  const hasEnoughRoles = roles.length >= 2

  const GenerateButton = () => (
    <div className="flex flex-col items-center gap-3 my-6">
      <button
        onClick={handleGenerateNarrative}
        disabled={isGenerating || !hasEnoughRoles}
        className="bg-[#C65911] hover:bg-[#a34a0e] text-white font-bold text-base px-8 py-3.5 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-3 shadow-md no-print"
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating Story...
          </>
        ) : (
          <>
            <span>&#10024;</span>
            {mentee.generatedNarrative ? 'Regenerate Career Story' : 'Generate Career Story'}
          </>
        )}
      </button>
      {!hasEnoughRoles && (
        <p className="text-xs text-gray-400">Requires at least 2 roles</p>
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
      <div className="bg-[#1F4E79] px-6 py-5 no-print">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link to="/mentor" className="text-blue-200 hover:text-white text-sm flex items-center gap-1 mb-2">
                &#8592; Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-white">Career Compass</h1>
              <p className="text-blue-200 text-sm">Mentor View &mdash; {mentee.name}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <SaveStatusIndicator status={saveStatus} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-200">{mentee.email}</span>
                <button
                  onClick={() => window.print()}
                  className="text-sm text-blue-200 hover:text-white border border-blue-400 hover:border-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Print
                </button>
              </div>
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

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* Mentor banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3 no-print">
          <div className="w-8 h-8 bg-[#1F4E79] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            BO
          </div>
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Mentor view</span> — your notes are visible only to you and will guide your coaching conversations with {mentee.name}.
          </p>
        </div>

        {/* Themes Panel */}
        <ThemesPanel
          themes={mentee.themes || []}
          themesGeneratedAt={mentee.themesGeneratedAt}
          onRegenerate={handleGenerateNarrative}
          isGenerating={isGenerating}
          hasEnoughRoles={hasEnoughRoles}
        />

        {/* Career History */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1F4E79]">Career History</h2>
            <p className="text-sm text-gray-500 mt-1">
              {roles.length} {roles.length === 1 ? 'role' : 'roles'} documented
              {mentee.updatedAt && ` · Last updated ${formatDate(mentee.updatedAt)}`}
            </p>
            {/* Revision summary */}
            {roles.some(r => r.aiFeedback) && (() => {
              const analyzedRoles = roles.filter(r => r.aiFeedback)
              const revisedCount = analyzedRoles.filter(r => r.revisedAfterFeedback).length
              return (
                <p className="text-xs mt-2 font-medium">
                  <span className={revisedCount === analyzedRoles.length ? 'text-green-700' : 'text-amber-700'}>
                    {revisedCount} of {analyzedRoles.length} {analyzedRoles.length === 1 ? 'role' : 'roles'} revised after feedback
                  </span>
                </p>
              )
            })()}
          </div>

          {roles.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
              <p className="text-sm">No roles added yet. The mentee needs to fill this in.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {roles.map((role, idx) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  menteeId={id}
                  onUpdate={handleRoleUpdate}
                  onEmergencyFlush={handleRoleEmergencyFlush}
                  onDelete={handleDeleteRole}
                  onMoveUp={(rid) => handleMoveRole(rid, 'up')}
                  onMoveDown={(rid) => handleMoveRole(rid, 'down')}
                  isMentorView={true}
                  mentorComments={mentorComments}
                  onAddComment={handleAddComment}
                  onUpdateComment={handleUpdateComment}
                  onDeleteComment={handleDeleteComment}
                  isFirst={idx === 0}
                  isLast={idx === roles.length - 1}
                />
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-center no-print">
            <button
              onClick={handleAddRole}
              className="border-2 border-dashed border-gray-300 hover:border-[#1F4E79] text-gray-500 hover:text-[#1F4E79] font-medium px-6 py-3 rounded-xl transition-colors text-sm"
            >
              + Add Role
            </button>
          </div>

          {hasEnoughRoles && <GenerateButton />}
        </section>

        {/* Passions, Strengths & Aspirations */}
        <section>
          <div className="mb-2">
            <h2 className="text-2xl font-bold text-[#1F4E79]">Passions, Strengths &amp; Aspirations</h2>
          </div>

          {/* PSA Analysis panel at top of section in mentor view */}
          {psaAnalysis && (
            <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <PSAAnalysisPanel
                psaAnalysis={psaAnalysis}
                isMentorView={true}
                onReAnalyze={handleReAnalyzePSA}
                isAnalyzing={isAnalyzingPSA}
              />
            </div>
          )}

          <div className="mb-6">
            <VennDiagram />
          </div>

          {/* Table Stakes prominently at top */}
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-6">
            <TableStakes
              menteeData={mentee}
              onUpdate={handleUpdate}
              isMentorView={true}
              mentorComments={mentorComments}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>

          <PassionsStrengthsAspirations
            menteeData={mentee}
            onUpdate={handleUpdate}
            onPSAAnalysisComplete={handlePSAAnalysisComplete}
            isMentorView={true}
            mentorComments={mentorComments}
            onAddComment={handleAddComment}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
          />
        </section>

        {/* Generate Story */}
        <GenerateButton />

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
            <div className="mt-4">
              <MentorComment
                section="narrative"
                menteeId={id}
                comments={mentorComments}
                onAdd={handleAddComment}
                onUpdate={handleUpdateComment}
                onDelete={handleDeleteComment}
              />
            </div>
          </section>
        )}

        {/* All My Notes Panel */}
        {mentorComments.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 no-print">
            <h2 className="text-lg font-bold text-[#1F4E79] mb-4">All My Notes</h2>
            <div className="space-y-3">
              {mentorComments.map(comment => {
                const roleId = comment.section.startsWith('role:')
                  ? comment.section.replace('role:', '')
                  : null
                const role = roleId ? roles.find(r => r.id === roleId) : null
                const sectionDisplay = role
                  ? `${role.title || 'Untitled Role'} at ${role.organization || 'Unknown'}`
                  : getSectionLabel(comment.section)

                return (
                  <div key={comment.id} className="border-l-4 border-[#1F4E79] pl-4 py-2 bg-blue-50 rounded-r">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#1F4E79] bg-blue-100 px-2 py-0.5 rounded">
                        {sectionDisplay}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-800">{comment.comment}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="pb-12 text-center">
          <p className="text-xs text-gray-300">Career Compass &mdash; Mentor View &mdash; {mentee.name}</p>
        </div>
      </div>
    </div>
  )
}
