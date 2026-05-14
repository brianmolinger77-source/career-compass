import React, { useState, useRef, useEffect } from 'react'
import { generateResumeBullets, regenerateSummary } from '../utils/api'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ResumeSection({ children }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-[#1F4E79] mb-2 border-b border-[#1F4E79] pb-1">
      {children}
    </h2>
  )
}

function AutoTextarea({ value, onChange, placeholder, className }) {
  return (
    <textarea
      ref={el => {
        if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
      }}
      value={value}
      rows={1}
      onChange={e => {
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
        onChange(e.target.value)
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}

export default function ResumeBuilder({ mentee, onUpdate, isMentorView = false }) {
  // ── Bullets ──────────────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [localBullets, setLocalBullets] = useState(() => mentee.resumeBullets || {})

  // ── Summary — only ever sourced from resumeSummary, never from generatedNarrative ──
  const [localSummary, setLocalSummary] = useState(() => mentee.resumeSummary || '')
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  // ── Skills ───────────────────────────────────────────────────────────────────
  const [localSkills, setLocalSkills] = useState(
    () => mentee.resumeSkills?.length ? mentee.resumeSkills : (mentee.themes || []).slice()
  )
  const [skillInput, setSkillInput] = useState('')

  // ── Certs & Education ────────────────────────────────────────────────────────
  const [localCerts, setLocalCerts] = useState(() => mentee.resumeCertifications || [])
  const [localEducation, setLocalEducation] = useState(() => mentee.resumeEducation || [])

  // One timer per field so saves never cancel each other
  const bulletsTimer = useRef(null)
  const skillsTimer  = useRef(null)
  const certsTimer   = useRef(null)
  const eduTimer     = useRef(null)

  // On mount: persist pre-populated skills if none are saved yet
  useEffect(() => {
    if (!isMentorView && !mentee.resumeSkills?.length && mentee.themes?.length) {
      schedule(skillsTimer, 'resumeSkills', mentee.themes.slice())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync each field independently when parent data changes
  useEffect(() => {
    if (mentee.resumeBullets) setLocalBullets(mentee.resumeBullets)
  }, [mentee.resumeBullets])

  useEffect(() => {
    if (mentee.resumeSummary) setLocalSummary(mentee.resumeSummary)
  }, [mentee.resumeSummary])

  useEffect(() => {
    if (mentee.resumeSkills?.length) setLocalSkills(mentee.resumeSkills)
  }, [mentee.resumeSkills])

  useEffect(() => {
    if (mentee.resumeCertifications?.length) setLocalCerts(mentee.resumeCertifications)
  }, [mentee.resumeCertifications])

  useEffect(() => {
    if (mentee.resumeEducation?.length) setLocalEducation(mentee.resumeEducation)
  }, [mentee.resumeEducation])

  const roles = mentee.roles || []
  const hasBullets = roles.some(r => localBullets[r.id]?.length > 0)

  function schedule(timerRef, field, value) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onUpdate({ [field]: value }), 1500)
  }

  // ── Bullet handlers ──────────────────────────────────────────────────────────
  function handleBulletChange(roleId, idx, value) {
    setLocalBullets(prev => {
      const arr = [...(prev[roleId] || [])]
      arr[idx] = value
      const next = { ...prev, [roleId]: arr }
      schedule(bulletsTimer, 'resumeBullets', next)
      return next
    })
  }

  function handleAddBullet(roleId) {
    setLocalBullets(prev => {
      const next = { ...prev, [roleId]: [...(prev[roleId] || []), ''] }
      schedule(bulletsTimer, 'resumeBullets', next)
      return next
    })
  }

  function handleRemoveBullet(roleId, idx) {
    setLocalBullets(prev => {
      const arr = [...(prev[roleId] || [])]
      arr.splice(idx, 1)
      const next = { ...prev, [roleId]: arr }
      schedule(bulletsTimer, 'resumeBullets', next)
      return next
    })
  }

  // ── Skill handlers ───────────────────────────────────────────────────────────
  function commitSkill(raw) {
    const skill = raw.trim()
    if (!skill || localSkills.includes(skill)) return
    const next = [...localSkills, skill]
    setLocalSkills(next)
    schedule(skillsTimer, 'resumeSkills', next)
  }

  function handleRemoveSkill(idx) {
    const next = localSkills.filter((_, i) => i !== idx)
    setLocalSkills(next)
    schedule(skillsTimer, 'resumeSkills', next)
  }

  function handleSkillKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitSkill(skillInput)
      setSkillInput('')
    } else if (e.key === 'Backspace' && !skillInput && localSkills.length > 0) {
      handleRemoveSkill(localSkills.length - 1)
    }
  }

  // ── Cert handlers ────────────────────────────────────────────────────────────
  function handleCertChange(idx, value) {
    const next = localCerts.map((c, i) => i === idx ? value : c)
    setLocalCerts(next)
    schedule(certsTimer, 'resumeCertifications', next)
  }

  function handleAddCert() { setLocalCerts(prev => [...prev, '']) }

  function handleRemoveCert(idx) {
    const next = localCerts.filter((_, i) => i !== idx)
    setLocalCerts(next)
    schedule(certsTimer, 'resumeCertifications', next)
  }

  // ── Education handlers ───────────────────────────────────────────────────────
  function handleEduChange(idx, value) {
    const next = localEducation.map((e, i) => i === idx ? value : e)
    setLocalEducation(next)
    schedule(eduTimer, 'resumeEducation', next)
  }

  function handleAddEdu() { setLocalEducation(prev => [...prev, '']) }

  function handleRemoveEdu(idx) {
    const next = localEducation.filter((_, i) => i !== idx)
    setLocalEducation(next)
    schedule(eduTimer, 'resumeEducation', next)
  }

  // ── Generate bullets ─────────────────────────────────────────────────────────
  async function handleGenerate() {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateResumeBullets(mentee.id)
      setLocalBullets(result.roleBullets)
      if (result.resumeSummary) setLocalSummary(result.resumeSummary)
    } catch (err) {
      setGenerateError('Resume generation unavailable right now — try again in a moment.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Regenerate summary only ──────────────────────────────────────────────────
  async function handleRegenerateSummary() {
    setIsRegeneratingSummary(true)
    setSummaryError(null)
    try {
      const result = await regenerateSummary(mentee.id)
      if (result.resumeSummary) setLocalSummary(result.resumeSummary)
    } catch (err) {
      setSummaryError('Summary generation unavailable right now — try again in a moment.')
    } finally {
      setIsRegeneratingSummary(false)
    }
  }

  function handlePrint() {
    document.body.classList.add('resume-print-mode')
    window.print()
    document.body.classList.remove('resume-print-mode')
  }

  const competencies = (mentee.themes || []).filter(Boolean)

  const bulletTextareaClass =
    'flex-1 text-sm text-gray-800 leading-relaxed border-b border-transparent hover:border-gray-200 focus:border-[#1F4E79] focus:outline-none bg-transparent py-0.5 transition-colors resize-none overflow-hidden'

  const listTextareaClass =
    'flex-1 text-sm text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-[#1F4E79] focus:outline-none bg-transparent py-0.5 transition-colors resize-none overflow-hidden'

  return (
    <div className="space-y-6">

      {/* ── Generate button (mentee view only) ───────────────────────────────── */}
      {!isMentorView && (
        <div className="no-print">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-bold text-[#1F4E79]">Resume Builder</h2>
              <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                Generate polished, civilian-ready resume bullets from your career history.
                Edit any field directly — changes save automatically.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-shrink-0 bg-[#C65911] hover:bg-[#a34a0e] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2 shadow-md"
            >
              {isGenerating
                ? <><Spinner /> Generating...</>
                : hasBullets ? '↺ Regenerate Bullets' : '✦ Generate Resume Bullets'
              }
            </button>
          </div>
          {generateError && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mt-2">
              {generateError}
            </p>
          )}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {!hasBullets && (
        <div className={isMentorView ? '' : 'no-print'}>
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">
              {isMentorView
                ? 'The mentee has not generated their resume yet.'
                : <>Click <strong>Generate Resume Bullets</strong> to create AI-crafted, civilian-ready bullets for each role.</>
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Formatted resume ─────────────────────────────────────────────────── */}
      {hasBullets && (
        <div id="resume-preview" className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Name / contact header */}
          <div className="px-8 pt-8 pb-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{mentee.name}</h1>
            {mentee.email && <p className="text-sm text-gray-600 mt-1">{mentee.email}</p>}
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* ── Professional Summary ──────────────────────────────────────── */}
            <section>
              <ResumeSection>Professional Summary</ResumeSection>

              {localSummary ? (
                <p className="text-sm text-gray-800 leading-relaxed">{localSummary}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  {isMentorView
                    ? 'No professional summary generated yet.'
                    : 'No summary yet — click Generate Summary below to create one.'}
                </p>
              )}

              {/* Generate / Regenerate Summary button — mentee view only */}
              {!isMentorView && (
                <div className="no-print mt-2 flex items-center gap-3">
                  <button
                    onClick={handleRegenerateSummary}
                    disabled={isRegeneratingSummary}
                    className="text-xs text-gray-400 hover:text-[#1F4E79] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRegeneratingSummary
                      ? <><Spinner /> Generating...</>
                      : localSummary ? '↺ Regenerate Summary' : '✦ Generate Summary'
                    }
                  </button>
                  {summaryError && (
                    <span className="text-xs text-amber-700">{summaryError}</span>
                  )}
                </div>
              )}
            </section>

            {/* ── Core Competencies ────────────────────────────────────────── */}
            {competencies.length > 0 && (
              <section>
                <ResumeSection>Core Competencies</ResumeSection>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {competencies.map((c, i) => (
                    <span key={i} className="text-sm text-gray-800">• {c}</span>
                  ))}
                </div>
              </section>
            )}

            {/* ── Professional Experience ───────────────────────────────────── */}
            <section>
              <ResumeSection>Professional Experience</ResumeSection>
              <div className="space-y-5">
                {roles.map(role => {
                  const bullets = localBullets[role.id] || []
                  return (
                    <div key={role.id}>
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <div>
                          <span className="text-sm font-bold text-gray-900">{role.title || 'Untitled Role'}</span>
                          {role.organization && (
                            <span className="text-sm text-gray-600"> &mdash; {role.organization}</span>
                          )}
                        </div>
                        {(role.startYear || role.endYear) && (
                          <span className="text-sm text-gray-500 flex-shrink-0">
                            {role.startYear || '?'} – {role.endYear || 'Present'}
                          </span>
                        )}
                      </div>

                      <ul className="space-y-1 mb-2">
                        {bullets.map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2 group">
                            <span className="text-gray-400 mt-0.5 flex-shrink-0 text-xs leading-5">•</span>
                            {isMentorView ? (
                              <span className="flex-1 text-sm text-gray-800 leading-relaxed py-0.5">{bullet}</span>
                            ) : (
                              <AutoTextarea
                                value={bullet}
                                onChange={v => handleBulletChange(role.id, idx, v)}
                                className={bulletTextareaClass}
                              />
                            )}
                            {!isMentorView && (
                              <button
                                onClick={() => handleRemoveBullet(role.id, idx)}
                                className="no-print opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-xs flex-shrink-0 mt-0.5"
                                title="Remove bullet"
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>

                      {!isMentorView && (
                        <button
                          onClick={() => handleAddBullet(role.id)}
                          className="no-print text-xs text-gray-400 hover:text-[#1F4E79] transition-colors ml-4"
                        >
                          + Add bullet
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Skills ───────────────────────────────────────────────────── */}
            <section>
              <ResumeSection>Skills</ResumeSection>
              <div className="flex flex-wrap items-center gap-2">
                {localSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full"
                  >
                    {skill}
                    {!isMentorView && (
                      <button
                        onClick={() => handleRemoveSkill(i)}
                        className="no-print ml-0.5 text-gray-400 hover:text-red-500 leading-none font-bold"
                        title="Remove skill"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}

                {!isMentorView && (
                  <input
                    type="text"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    onBlur={() => {
                      if (skillInput.trim()) { commitSkill(skillInput); setSkillInput('') }
                    }}
                    placeholder="+ Add skill"
                    className="no-print text-sm text-gray-500 placeholder-gray-400 border border-dashed border-gray-300 hover:border-[#1F4E79] focus:border-[#1F4E79] focus:outline-none rounded-full px-3 py-1 w-28 transition-colors bg-transparent"
                  />
                )}
              </div>
              {localSkills.length === 0 && (
                <p className={`text-xs text-gray-400 italic mt-2 ${isMentorView ? '' : 'no-print'}`}>
                  {isMentorView ? 'No skills added yet.' : 'Type a skill above and press Enter — or generate your career story first to pre-populate from your themes.'}
                </p>
              )}
            </section>

            {/* ── Certifications & Clearances ───────────────────────────────── */}
            <section>
              <ResumeSection>Certifications &amp; Clearances</ResumeSection>
              {localCerts.length === 0 ? (
                <p className="text-sm text-gray-400 italic mb-3">
                  {isMentorView ? 'None added yet.' : 'Add any certifications, licenses, or security clearances relevant to your target role'}
                </p>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  {localCerts.map((cert, idx) => (
                    <li key={idx} className="flex items-start gap-2 group">
                      <span className="text-gray-400 flex-shrink-0 text-xs mt-1">•</span>
                      {isMentorView ? (
                        <span className="flex-1 text-sm text-gray-800 py-0.5">{cert}</span>
                      ) : (
                        <AutoTextarea
                          value={cert}
                          onChange={v => handleCertChange(idx, v)}
                          placeholder="e.g. Project Management Professional (PMP), 2023"
                          className={listTextareaClass}
                        />
                      )}
                      {!isMentorView && (
                        <button
                          onClick={() => handleRemoveCert(idx)}
                          className="no-print opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-xs flex-shrink-0 mt-1"
                          title="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!isMentorView && (
                <button
                  onClick={handleAddCert}
                  className="no-print text-xs text-gray-400 hover:text-[#1F4E79] transition-colors"
                >
                  + Add certification
                </button>
              )}
            </section>

            {/* ── Education ────────────────────────────────────────────────── */}
            <section>
              <ResumeSection>Education</ResumeSection>
              {localEducation.length === 0 ? (
                <p className="text-sm text-gray-400 italic mb-3">
                  {isMentorView ? 'None added yet.' : 'Add your education — degree, institution, and year'}
                </p>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  {localEducation.map((edu, idx) => (
                    <li key={idx} className="flex items-start gap-2 group">
                      <span className="text-gray-400 flex-shrink-0 text-xs mt-1">•</span>
                      {isMentorView ? (
                        <span className="flex-1 text-sm text-gray-800 py-0.5">{edu}</span>
                      ) : (
                        <AutoTextarea
                          value={edu}
                          onChange={v => handleEduChange(idx, v)}
                          placeholder="e.g. B.S. Business Administration, University of Maryland, 2012"
                          className={listTextareaClass}
                        />
                      )}
                      {!isMentorView && (
                        <button
                          onClick={() => handleRemoveEdu(idx)}
                          className="no-print opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-xs flex-shrink-0 mt-1"
                          title="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!isMentorView && (
                <button
                  onClick={handleAddEdu}
                  className="no-print text-xs text-gray-400 hover:text-[#1F4E79] transition-colors"
                >
                  + Add education
                </button>
              )}
            </section>

          </div>

          {/* Print button (both views) */}
          <div className="no-print px-8 pb-6 pt-2 flex items-center gap-3 border-t border-gray-100 mt-2">
            <button
              onClick={handlePrint}
              className="text-sm text-gray-700 border border-gray-300 hover:border-[#1F4E79] hover:text-[#1F4E79] px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Print Resume / Save PDF
            </button>
            {!isMentorView && <span className="text-xs text-gray-400">Click any field to edit it</span>}
          </div>
        </div>
      )}
    </div>
  )
}
