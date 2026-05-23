import React, { useState, useRef } from 'react'
import MentorComment from './MentorComment'
import { analyzePSA } from '../utils/api'

const SECTIONS = [
  {
    key: 'passions',
    label: 'My Passions',
    definition: "Passions are the activities and actions that charge your battery — the work that energizes you, that you'd do beyond what's required. Be honest here, not aspirational. A passion isn't what you think you should enjoy. It's what actually lights you up.",
    prompts: [
      "What kinds of tasks make the day fly by?",
      "What work do you find yourself doing extra, beyond what's required?",
      "What drains your energy, even if you're good at it?"
    ]
  },
  {
    key: 'strengths',
    label: 'My Strengths',
    definition: "A strength is something a colleague, supervisor, or teammate has told you that you're good at — in a performance review, in feedback, or just in passing. Strengths are externally validated, not self-declared. And critically: a strength is not necessarily something you enjoy. You may be excellent at something that drains your battery. Knowing the difference between your strengths and your passions is one of the most useful things this exercise will surface.",
    prompts: [
      "What have supervisors consistently praised in your performance reviews?",
      "What do colleagues ask you for help with?",
      "What have you been told you make look easy, even when it's hard?"
    ]
  },
  {
    key: 'aspirations',
    label: 'My Aspirations',
    definition: "Aspirations are about the conditions in which you do your best work. Not a job title — the actual experience of the work itself. Close your eyes and picture an ideal Tuesday at work. Where are you? Who's around you? What's the pace? Are you leading, building, solving, advising? The goal isn't to describe a fantasy — it's to identify the environment where your strengths and passions are most likely to thrive together.",
    prompts: [
      "Where are you working? (Office, remote, outdoors, city, small town?)",
      "Who is around you? (Large team, small team, solo, diverse backgrounds?)",
      "What is the pace? (Fast-moving startup, stable established company?)",
      "Are you leading people, contributing individually, or both?",
      "What kind of problems are you solving day to day?"
    ]
  }
]

export default function PassionsStrengthsAspirations({
  menteeData,
  onUpdate,
  onPSAAnalysisComplete,
  isMentorView = false,
  mentorComments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  showAnalyzeButton = true
}) {
  const [localData, setLocalData] = useState({
    passions: menteeData.passions || '',
    strengths: menteeData.strengths || '',
    aspirations: menteeData.aspirations || ''
  })
  const [isAnalyzingPSA, setIsAnalyzingPSA] = useState(false)
  const [psaError, setPSAError] = useState(null)
  const debounceTimers = useRef({})

  function handleChange(key, value) {
    const updated = { ...localData, [key]: value }
    setLocalData(updated)

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      onUpdate({ [key]: value })
    }, 1500)
  }

  async function handleAnalyzePSA() {
    setIsAnalyzingPSA(true)
    setPSAError(null)
    let lastErr
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await analyzePSA(menteeData.id)
        if (onPSAAnalysisComplete) onPSAAnalysisComplete(result.analysis, result.mentee)
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

  const allThreeFilled = localData.passions.trim() && localData.strengths.trim() && localData.aspirations.trim()

  return (
    <div className="space-y-8">
      {SECTIONS.map(section => (
        <div key={section.key} className="space-y-3">
          <h3 className="text-xl font-bold text-[#1F4E79]">{section.label}</h3>

          {/* Definition callout */}
          <blockquote className="border-l-4 border-[#1F4E79] pl-4 py-2 bg-blue-50 rounded-r-lg">
            <p className="text-sm text-gray-700 leading-relaxed">{section.definition}</p>
          </blockquote>

          {/* Prompt questions */}
          <div className="space-y-1 bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Prompts to get you thinking
            </p>
            {section.prompts.map((prompt, i) => (
              <p key={i} className="text-sm text-gray-500 italic flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8227;</span>
                <span>{prompt}</span>
              </p>
            ))}
          </div>

          {/* Passions quality bar */}
          {section.key === 'passions' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed no-print">
              Be honest here, not aspirational. A passion isn't what you think you should enjoy — it's what actually charges your battery. The best signal: what work have you done beyond what's required, just because it interested you? Start there.
            </p>
          )}

          {/* Strengths-specific helper line */}
          {section.key === 'strengths' && (
            <p className="text-xs text-gray-400 italic">
              Each strength should be something someone else recognized in you — not just something you believe about yourself.
            </p>
          )}

          <textarea
            value={localData[section.key]}
            onChange={e => handleChange(section.key, e.target.value)}
            placeholder={
              section.key === 'strengths'
                ? "Try starting each strength like this: 'My [supervisor / colleague / teammate] told me I was good at...'\nFor example: 'My supervisor told me I was good at staying calm under pressure and making quick decisions when things went wrong.'"
                : `Write about your ${section.key.toLowerCase()} here...`
            }
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent resize-y"
          />

          {isMentorView && (
            <MentorComment
              section={section.key}
              menteeId={menteeData.id}
              comments={mentorComments}
              onAdd={onAddComment}
              onUpdate={onUpdateComment}
              onDelete={onDeleteComment}
            />
          )}
        </div>
      ))}

      {/* PSA Cross-Section Analyze Button — shown after all three sections are filled */}
      {showAnalyzeButton && allThreeFilled && (
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
    </div>
  )
}
