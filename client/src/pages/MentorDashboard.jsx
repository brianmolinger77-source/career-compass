import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMentees, createMentee, logout, checkAuth, getMentors, assignMentee } from '../utils/api'

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
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function CompletionBar({ pct }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-[#C65911]' : 'bg-gray-300'
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Completion</span>
        <span className="text-xs font-semibold text-gray-700">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function MentorDashboard() {
  const [mentees, setMentees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState(null)
  const [sessionMentorId, setSessionMentorId] = useState(null)
  const [adminView, setAdminView] = useState(false)
  const [mentors, setMentors] = useState([])
  const [reassigningId, setReassigningId] = useState(null)
  const [reassignValue, setReassignValue] = useState('')
  const [reassignSaving, setReassignSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState(null)
  const [createError, setCreateError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function init() {
      try {
        const auth = await checkAuth()
        setRole(auth.role)
        setSessionMentorId(auth.mentorId)
      } catch (_) {}
      await loadMentees()
    }
    init()
  }, [])

  async function loadMentees() {
    try {
      const data = await getMentees()
      setMentees(data)
    } catch (err) {
      console.error('Failed to load mentees:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSwitchToAdmin() {
    setAdminView(true)
    if (mentors.length === 0) {
      try {
        const data = await getMentors()
        setMentors(data)
      } catch (err) {
        console.error('Failed to load mentors:', err)
      }
    }
  }

  async function handleReassign(menteeId) {
    if (!reassignValue) return
    setReassignSaving(true)
    try {
      await assignMentee(menteeId, reassignValue)
      await loadMentees()
      // Refresh mentors in case none were loaded yet
      if (mentors.length === 0) {
        const data = await getMentors()
        setMentors(data)
      }
      setReassigningId(null)
      setReassignValue('')
    } catch (err) {
      console.error('Reassign failed:', err)
    } finally {
      setReassignSaving(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const result = await createMentee(newName, newEmail)
      setCreatedUrl(`${window.location.origin}/mentee/${result.mentee.id}`)
      setMentees(prev => [result.mentee, ...prev])
    } catch (err) {
      setCreateError(err.message || 'Failed to create mentee')
    } finally {
      setCreating(false)
    }
  }

  function resetModal() {
    setShowModal(false)
    setNewName('')
    setNewEmail('')
    setCreatedUrl(null)
    setCreateError('')
  }

  async function handleLogout() {
    try {
      await logout()
      navigate('/mentor/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const isSuperuser = role === 'superuser'

  // In "My Mentees" mode, superuser sees only their own mentees
  const visibleMentees = (isSuperuser && !adminView)
    ? mentees.filter(m => m.mentorId === sessionMentorId)
    : mentees

  const activeMentors = mentors.filter(m => m.isActive)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1F4E79] px-6 py-5 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Career Compass</h1>
            <p className="text-blue-200 text-sm mt-0.5">Mentor Dashboard</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-blue-200 hover:text-white border border-blue-400 hover:border-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Superuser view toggle */}
        {isSuperuser && (
          <div className="flex gap-2 mb-6 no-print">
            <button
              onClick={() => setAdminView(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                !adminView
                  ? 'bg-[#1F4E79] text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-[#1F4E79] hover:text-[#1F4E79]'
              }`}
            >
              My Mentees
            </button>
            <button
              onClick={handleSwitchToAdmin}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                adminView
                  ? 'bg-[#1F4E79] text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-[#1F4E79] hover:text-[#1F4E79]'
              }`}
            >
              All Mentees + Admin
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {adminView ? 'All Mentees' : 'Your Mentees'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {visibleMentees.length} {visibleMentees.length === 1 ? 'mentee' : 'mentees'}
              {adminView ? ' in the program' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="no-print bg-[#C65911] hover:bg-[#a34a0e] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Add New Mentee
          </button>
        </div>

        {/* Mentee grid */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading mentees...</div>
        ) : visibleMentees.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700">No mentees yet</h3>
            <p className="text-gray-400 mt-1 text-sm">Add your first mentee to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleMentees.map(mentee => {
              const pct = calcCompletion(mentee)
              const isReassigning = reassigningId === mentee.id
              return (
                <div
                  key={mentee.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                >
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{mentee.name}</h3>
                    <p className="text-sm text-gray-500">{mentee.email || 'No email'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <span className="font-medium text-gray-600">Created: </span>
                      {formatDate(mentee.createdAt)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Updated: </span>
                      {formatDate(mentee.updatedAt)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Roles: </span>
                      {(mentee.roles || []).length}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Story: </span>
                      {mentee.generatedNarrative ? (
                        <span className="text-green-600 font-semibold">Generated</span>
                      ) : (
                        <span className="text-gray-400">Not yet</span>
                      )}
                    </div>
                    {adminView && (
                      <div className="col-span-2">
                        <span className="font-medium text-gray-600">Mentor: </span>
                        <span className="text-gray-700">
                          {mentee.mentor ? mentee.mentor.name : '—'}
                        </span>
                      </div>
                    )}
                    {(mentee.jobAnalyses || []).some(a => a.mentorFlagged) && (
                      <div className="col-span-2">
                        <span className="inline-block bg-amber-100 text-amber-800 border border-amber-300 rounded px-2 py-0.5 font-medium">
                          📋 Job posting — we'll discuss
                        </span>
                      </div>
                    )}
                  </div>

                  <CompletionBar pct={pct} />

                  {/* Admin: reassign control */}
                  {adminView && (
                    <div className="no-print">
                      {isReassigning ? (
                        <div className="flex gap-2 items-center">
                          <select
                            value={reassignValue}
                            onChange={e => setReassignValue(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                          >
                            <option value="">Select mentor…</option>
                            {activeMentors.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleReassign(mentee.id)}
                            disabled={!reassignValue || reassignSaving}
                            className="bg-[#1F4E79] hover:bg-[#1a4268] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                          >
                            {reassignSaving ? '…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setReassigningId(null); setReassignValue('') }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setReassigningId(mentee.id); setReassignValue('') }}
                          className="text-xs text-gray-500 hover:text-[#1F4E79] border border-gray-200 hover:border-[#1F4E79] px-3 py-1.5 rounded-lg w-full transition-colors"
                        >
                          Reassign
                        </button>
                      )}
                    </div>
                  )}

                  <Link
                    to={`/mentor/mentee/${mentee.id}`}
                    className="mt-1 block text-center bg-[#1F4E79] hover:bg-[#1a4268] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    Open Document
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Mentee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Mentee</h2>

            {createdUrl ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">Mentee created!</p>
                  <p className="text-xs text-green-700 mb-3">
                    Share this unique link with your mentee:
                  </p>
                  <div className="bg-white border border-green-300 rounded-lg px-3 py-2 font-mono text-sm text-green-900 break-all">
                    {createdUrl}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  This link is their personal Career Compass document. Bookmark it — no login required for them.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(createdUrl)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:border-[#1F4E79] hover:text-[#1F4E79]"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={resetModal}
                    className="flex-1 bg-[#1F4E79] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#1a4268]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Matt Moore"
                    required
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="e.g. mmoore9241@yahoo.com"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                </div>

                {createError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {createError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="flex-1 bg-[#C65911] hover:bg-[#a34a0e] text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      'Create Mentee'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
