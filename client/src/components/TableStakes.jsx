import React, { useState, useRef } from 'react'
import MentorComment from './MentorComment'

const SUGGESTION_CHIPS = [
  "Clear mission or purpose",
  "Collaborative team environment",
  "Remote or hybrid flexibility",
  "Opportunity to lead people",
  "Fast-paced and innovative culture",
  "Work-life boundaries respected",
  "Continuous learning opportunities",
  "Meaningful social impact",
  "Stable, established organization",
  "Small team or startup energy"
]

const DEFINITION = "Table Stakes are your non-negotiables — the conditions that must be present (or absent) in any role for you to do your best work. These aren't preferences. They are the things you've learned, through experience, that you cannot compromise on without it eventually costing you your performance or your wellbeing. A role can look perfect on paper — but if it fails your table stakes, it's the wrong role. Be honest and be selective: if everything is a non-negotiable, nothing is."

const PROMPTS = [
  "Think about a role or environment where you were least effective or fulfilled. What was missing — or present — that made it wrong?",
  "What conditions are absolutely necessary for you to bring your best self to work?",
  "What would make you walk away from an otherwise great opportunity?"
]

export default function TableStakes({
  menteeData,
  onUpdate,
  isMentorView = false,
  mentorComments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment
}) {
  const [text, setText] = useState(menteeData.tableStakes || '')
  const [tags, setTags] = useState(menteeData.tableStakesTags || [])
  const [customTag, setCustomTag] = useState('')
  const textDebounce = useRef(null)
  const tagsDebounce = useRef(null)

  function handleTextChange(value) {
    setText(value)
    if (textDebounce.current) clearTimeout(textDebounce.current)
    textDebounce.current = setTimeout(() => {
      onUpdate({ tableStakes: value })
    }, 1500)
  }

  function updateTags(newTags) {
    setTags(newTags)
    if (tagsDebounce.current) clearTimeout(tagsDebounce.current)
    tagsDebounce.current = setTimeout(() => {
      onUpdate({ tableStakesTags: newTags })
    }, 500)
  }

  function toggleChip(chip) {
    const newTags = tags.includes(chip)
      ? tags.filter(t => t !== chip)
      : [...tags, chip]
    updateTags(newTags)
  }

  function addCustomTag() {
    const trimmed = customTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      updateTags([...tags, trimmed])
    }
    setCustomTag('')
  }

  function removeTag(tag) {
    updateTags(tags.filter(t => t !== tag))
  }

  const headerText = isMentorView
    ? 'Non-Negotiables — filter any opportunity against these first.'
    : 'My Table Stakes'

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-xl font-bold ${isMentorView ? 'text-[#C65911]' : 'text-[#1F4E79]'}`}>
          {headerText}
        </h3>
        {isMentorView && (
          <p className="text-sm text-gray-500 mt-0.5">
            These are the filters for every opportunity — if it fails here, it's the wrong role.
          </p>
        )}
      </div>

      {/* Definition callout */}
      <blockquote className="border-l-4 border-[#1F4E79] pl-4 py-2 bg-blue-50 rounded-r-lg">
        <p className="text-sm text-gray-700 leading-relaxed">{DEFINITION}</p>
      </blockquote>

      {/* Prompts */}
      <div className="space-y-1 bg-gray-50 rounded-lg px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Prompts to get you thinking
        </p>
        {PROMPTS.map((prompt, i) => (
          <p key={i} className="text-sm text-gray-500 italic flex items-start gap-2">
            <span className="text-gray-300 mt-0.5">&#8227;</span>
            <span>{prompt}</span>
          </p>
        ))}
      </div>

      <textarea
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        placeholder="Write freely about your non-negotiables here..."
        rows={4}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent resize-y"
      />

      {/* Suggestion chips */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Quick add — tap to toggle
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTION_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => toggleChip(chip)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                tags.includes(chip)
                  ? 'bg-[#1F4E79] text-white border-[#1F4E79]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#1F4E79] hover:text-[#1F4E79]'
              }`}
            >
              {tags.includes(chip) ? '✓ ' : ''}{chip}
            </button>
          ))}
        </div>
      </div>

      {/* Custom tag input */}
      <div className="flex gap-2 items-center no-print">
        <input
          type="text"
          value={customTag}
          onChange={e => setCustomTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
          placeholder="Add your own non-negotiable..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
        />
        <button
          onClick={addCustomTag}
          disabled={!customTag.trim()}
          className="bg-[#1F4E79] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#1a4268] disabled:opacity-40 font-medium"
        >
          Add
        </button>
      </div>

      {/* Selected tags */}
      {tags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Your Non-Negotiables
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 bg-[#1F4E79] text-white text-sm px-3 py-1.5 rounded-full font-medium"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-white opacity-70 hover:opacity-100 leading-none text-base no-print"
                  aria-label={`Remove ${tag}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {isMentorView && (
        <MentorComment
          section="tableStakes"
          menteeId={menteeData.id}
          comments={mentorComments}
          onAdd={onAddComment}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
        />
      )}
    </div>
  )
}
