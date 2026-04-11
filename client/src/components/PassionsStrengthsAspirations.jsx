import React, { useState, useRef } from 'react'
import MentorComment from './MentorComment'

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
  isMentorView = false,
  mentorComments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment
}) {
  const [localData, setLocalData] = useState({
    passions: menteeData.passions || '',
    strengths: menteeData.strengths || '',
    aspirations: menteeData.aspirations || ''
  })
  const debounceTimers = useRef({})

  function handleChange(key, value) {
    const updated = { ...localData, [key]: value }
    setLocalData(updated)

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      onUpdate({ [key]: value })
    }, 1500)
  }

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

          <textarea
            value={localData[section.key]}
            onChange={e => handleChange(section.key, e.target.value)}
            placeholder={`Write about your ${section.key.toLowerCase()} here...`}
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
    </div>
  )
}
