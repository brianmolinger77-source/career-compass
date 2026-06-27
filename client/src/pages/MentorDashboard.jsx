import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMentees, createMentee, logout, checkAuth, getMentors, assignMentee, updateMenteePin, getUsageStats, saveMentorNotes } from '../utils/api'

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
  const [newPin, setNewPin] = useState('')
  const [newBranch, setNewBranch] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState(null)
  const [createError, setCreateError] = useState('')
  const [pinEditing, setPinEditing] = useState(null)
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [usageView, setUsageView] = useState(false)
  const [usageData, setUsageData] = useState(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(null)
  const navigate = useNavigate()

  const [notesOpen, setNotesOpen] = useState({})
  const [notesValues, setNotesValues] = useState({})

  async function handleSaveNotes(menteeId) {
    try {
      await saveMentorNotes(menteeId, notesValues[menteeId] ?? '')
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
  }

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
      setNotesValues(Object.fromEntries(data.map(m => [m.id, m.mentorNotes || ''])))
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
        const result = await createMentee(newName, newEmail, newPin, newBranch)
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
    setNewPin('')
    setNewBranch('')
    setCreatedUrl(null)
    setCreateError('')
  }

  async function handlePinUpdate(menteeId) {
    if (!/^\d{6}$/.test(pinValue)) {
      setPinError('PIN must be exactly 6 digits')
      return
    }
    setPinSaving(true)
    setPinError('')
    try {
      await updateMenteePin(menteeId, pinValue)
      setPinSuccess(menteeId)
      setPinEditing(null)
      setPinValue('')
      setTimeout(() => setPinSuccess(null), 3000)
    } catch (err) {
      setPinError(err.message || 'Failed to update PIN')
    } finally {
      setPinSaving(false)
    }
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

  useEffect(() => {
    if (usageView && isSuperuser) {
      setUsageLoading(true)
      getUsageStats()
        .then(data => setUsageData(data))
        .catch(err => console.error('Failed to load usage stats:', err))
        .finally(() => setUsageLoading(false))
    }
  }, [usageView, isSuperuser])

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
                onClick={() => { setAdminView(false); setUsageView(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                !adminView
                  ? 'bg-[#1F4E79] text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-[#1F4E79] hover:text-[#1F4E79]'
              }`}
            >
              My Mentees
            </button>
            <button
                onClick={() => { handleSwitchToAdmin(); setUsageView(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                adminView
                  ? 'bg-[#1F4E79] text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-[#1F4E79] hover:text-[#1F4E79]'
              }`}
            >
              All Mentees + Admin
            </button>
              <button
                onClick={() => { setUsageView(true); setAdminView(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  usageView
                    ? 'bg-[#1F4E79] text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:border-[#1F4E79] hover:text-[#1F4E79]'
                }`}
              >
                Cost &amp; Usage
              </button>
          </div>
        )}

        {/* Cost & Usage Panel */}
        {usageView && isSuperuser && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Cost &amp; Usage</h2>
            <p className="text-sm text-gray-500 mb-6">AI token usage logged since May 25, 2026. Pricing reflects Anthropic published rates as of May 2026 and should be updated if pricing changes.</p>

            {usageLoading && <div className="text-gray-400 py-8 text-center">Loading usage data...</div>}

            {!usageLoading && usageData && (() => {
              const INPUT_COST_PER_M = 3.00
              const OUTPUT_COST_PER_M = 15.00
              const calcCost = (inp, out, mult) =>
                ((inp / 1_000_000) * INPUT_COST_PER_M + (out / 1_000_000) * OUTPUT_COST_PER_M) * mult
              const endpoints = Object.entries(usageData.byEndpoint || {})
              const totalCost = calcCost(usageData.totalInputTokens, usageData.totalOutputTokens, 1)
              const perMentee = usageData.distinctMentees > 0 ? totalCost / usageData.distinctMentees : 0

              return (
                <>
                  {/* Summary row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[{label: "Total Calls", value: usageData.totalCalls},
                      {label: "Input Tokens", value: usageData.totalInputTokens?.toLocaleString()},
                      {label: "Output Tokens", value: usageData.totalOutputTokens?.toLocaleString()},
                      {label: "Cost at Current Rates", value: `$${totalCost.toFixed(4)}`}
                    ].map(({label, value}) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">{label}</div>
                        <div className="text-xl font-bold text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per-mentee average */}
                  <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <span className="text-sm font-semibold text-[#1F4E79]">Per-mentee average (current rates): </span>
                    <span className="text-sm text-gray-700">${perMentee.toFixed(4)} across {usageData.distinctMentees} mentee{usageData.distinctMentees !== 1 ? "s" : ""} with AI activity</span>
                  </div>

                  {/* By-endpoint table */}
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Usage by endpoint</h3>
                  <div className="overflow-x-auto mb-8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {["Endpoint","Calls","Input tokens","Output tokens","Cost (1x)","Cost (2x)","Cost (5x)","Cost (10x)"].map(h => (
                            <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {endpoints.map(([ep, d]) => (
                          <tr key={ep} className="border-b border-gray-100">
                            <td className="py-2 pr-4 font-mono text-xs text-gray-700">{ep}</td>
                            <td className="py-2 pr-4 text-gray-700">{d.calls}</td>
                            <td className="py-2 pr-4 text-gray-700">{d.inputTokens?.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-gray-700">{d.outputTokens?.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-gray-700">${calcCost(d.inputTokens, d.outputTokens, 1).toFixed(4)}</td>
                            <td className="py-2 pr-4 text-gray-700">${calcCost(d.inputTokens, d.outputTokens, 2).toFixed(4)}</td>
                            <td className="py-2 pr-4 text-gray-700">${calcCost(d.inputTokens, d.outputTokens, 5).toFixed(4)}</td>
                            <td className="py-2 pr-4 text-gray-700">${calcCost(d.inputTokens, d.outputTokens, 10).toFixed(4)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold bg-gray-50">
                          <td className="py-2 pr-4 text-gray-900">TOTAL</td>
                          <td className="py-2 pr-4 text-gray-900">{usageData.totalCalls}</td>
                          <td className="py-2 pr-4 text-gray-900">{usageData.totalInputTokens?.toLocaleString()}</td>
                          <td className="py-2 pr-4 text-gray-900">{usageData.totalOutputTokens?.toLocaleString()}</td>
                          <td className="py-2 pr-4 text-gray-900">${calcCost(usageData.totalInputTokens, usageData.totalOutputTokens, 1).toFixed(4)}</td>
                          <td className="py-2 pr-4 text-gray-900">${calcCost(usageData.totalInputTokens, usageData.totalOutputTokens, 2).toFixed(4)}</td>
                          <td className="py-2 pr-4 text-gray-900">${calcCost(usageData.totalInputTokens, usageData.totalOutputTokens, 5).toFixed(4)}</td>
                          <td className="py-2 pr-4 text-gray-900">${calcCost(usageData.totalInputTokens, usageData.totalOutputTokens, 10).toFixed(4)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Pricing note */}
                  <p className="text-xs text-gray-400">Baseline: $3.00 per 1M input tokens, $15.00 per 1M output tokens (claude-sonnet-4, May 2026). Update PRICING constants in MentorDashboard.jsx when rates change.</p>
                </>
              )
            })()}

            {!usageLoading && usageData && usageData.totalCalls === 0 && (
              <div className="text-center py-12 text-gray-400">No AI calls logged yet. Usage tracking began May 25, 2026.</div>
            )}
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

                  {/* PIN management */}
                  {!adminView && (
                    <div className="no-print">
                      {pinEditing === mentee.id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={pinValue}
                              onChange={e => { setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError('') }}
                              placeholder="New 6-digit PIN"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                            />
                            <button
                              onClick={() => handlePinUpdate(mentee.id)}
                              disabled={pinSaving || pinValue.length !== 6}
                              className="bg-[#1F4E79] hover:bg-[#1a4268] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                            >
                              {pinSaving ? '…' : 'Save'}
                            </button>
                            <button
                              onClick={() => { setPinEditing(null); setPinValue(''); setPinError('') }}
                              className="text-xs text-gray-500 hover:text-gray-700 px-1"
                            >
                              ✕
                            </button>
                          </div>
                          {pinError && <p className="text-xs text-red-600">{pinError}</p>}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setPinEditing(mentee.id); setPinValue(''); setPinError('') }}
                          className="w-full text-xs text-gray-500 border border-gray-200 hover:border-[#1F4E79] hover:text-[#1F4E79] rounded-lg px-3 py-1.5 transition-colors text-left"
                        >
                          {pinSuccess === mentee.id ? '✓ PIN updated' : '🔑 Set / Reset PIN'}
                        </button>
                      )}
                    </div>
                  )}

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

                  {/* Session notes */}
                  {!adminView && (
                    <div className="border-t border-gray-100 pt-3">
                      <button
                        onClick={() => setNotesOpen(prev => ({ ...prev, [mentee.id]: !prev[mentee.id] }))}
                        className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700"
                      >
                        <span className="flex items-center gap-1.5">
                          {notesValues[mentee.id] && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                          )}
                          Session notes
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" className={"w-3.5 h-3.5 transition-transform " + (notesOpen[mentee.id] ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {notesOpen[mentee.id] && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={notesValues[mentee.id] ?? ''}
                            onChange={e => setNotesValues(prev => ({ ...prev, [mentee.id]: e.target.value }))}
                            rows={3}
                            placeholder="Notes visible only to you..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 resize-y focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent"
                          />
                          <button
                            onClick={() => handleSaveNotes(mentee.id)}
                            className="text-xs bg-[#1F4E79] hover:bg-[#1a4268] text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Save notes
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Their PIN</p>
                  <p className="text-lg font-mono font-bold text-blue-900 tracking-widest">{newPin}</p>
                  <p className="text-xs text-blue-700 mt-1">Share this PIN directly with your mentee — they will need it to access their page.</p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access PIN <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Share this PIN directly with your mentee. They will need it to access their page.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Military Branch
                  </label>
                  <select
                    value={newBranch}
                    onChange={e => setNewBranch(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  >
                    <option value="">Select branch (optional)</option>
                    <option value="U.S. Army">U.S. Army</option>
                    <option value="U.S. Navy">U.S. Navy</option>
                    <option value="U.S. Marine Corps">U.S. Marine Corps</option>
                    <option value="U.S. Air Force">U.S. Air Force</option>
                    <option value="U.S. Coast Guard">U.S. Coast Guard</option>
                    <option value="U.S. Space Force">U.S. Space Force</option>
                    <option value="Other">Other</option>
                  </select>
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
