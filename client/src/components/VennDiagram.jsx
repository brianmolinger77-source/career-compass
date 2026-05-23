import React, { useState } from 'react'

// ── Ring definitions (used by mobile legend) ─────────────────────────────────
const DEFINITIONS = {
  Passions:
    "The activities and actions that charge your battery — the work that energizes you, that you'd do beyond what's required. Be honest here, not aspirational. A passion isn't what you think you should enjoy. It's what actually lights you up.",
  Strengths:
    "Something a colleague, supervisor, or teammate has told you that you're good at — in a performance review, in feedback, or just in passing. Strengths are externally validated, not self-declared. And critically: a strength is not necessarily something you enjoy.",
  Aspirations:
    "The conditions in which you do your best work. Close your eyes and picture an ideal Tuesday at work. Where are you? Who's around you? What's the pace? Are you leading, building, solving, advising? Identify the environment where your strengths and passions are most likely to thrive together.",
}

const LEGEND = [
  { id: 'Passions',    bg: '#EBF5FF', border: '#185FA5', textColor: '#185FA5' },
  { id: 'Strengths',   bg: '#E8F5F0', border: '#0F6E56', textColor: '#0F6E56' },
  { id: 'Aspirations', bg: '#FDF3E7', border: '#854F0B', textColor: '#854F0B' },
]

// ── Component ────────────────────────────────────────────────────────────────
export default function VennDiagram() {
  const [mobileActive, setMobileActive] = useState(null)

  function toggleMobile(id) {
    setMobileActive(prev => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col items-center py-6 px-4 relative">

      {/* ── SVG diagram ─────────────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 680 500"
        className="w-full max-w-[680px]"
        aria-label="Venn diagram: where Passions, Strengths, and Aspirations converge is where a great, fulfilling career lives"
        overflow="visible"
      >
        <defs>
          <clipPath id="cp-p">
            <circle cx="300" cy="195" r="148" />
          </clipPath>
          <clipPath id="cp-s">
            <circle cx="420" cy="195" r="148" />
          </clipPath>
          <clipPath id="cp-a">
            <circle cx="360" cy="305" r="148" />
          </clipPath>
        </defs>

        {/* Circle fills */}
        <circle cx="300" cy="195" r="148" fill="#185FA5" fillOpacity="0.12" />
        <circle cx="420" cy="195" r="148" fill="#0F6E56" fillOpacity="0.12" />
        <circle cx="360" cy="305" r="148" fill="#854F0B" fillOpacity="0.12" />

        {/* Pairwise overlaps — slightly darker tint via clip paths */}
        {/* Passions ∩ Strengths */}
        <g clipPath="url(#cp-p)">
          <circle cx="420" cy="195" r="148" fill="#185FA5" fillOpacity="0.12" />
        </g>
        {/* Passions ∩ Aspirations */}
        <g clipPath="url(#cp-p)">
          <circle cx="360" cy="305" r="148" fill="#854F0B" fillOpacity="0.12" />
        </g>
        {/* Strengths ∩ Aspirations */}
        <g clipPath="url(#cp-s)">
          <circle cx="360" cy="305" r="148" fill="#0F6E56" fillOpacity="0.12" />
        </g>

        {/* Triple intersection */}
        <g clipPath="url(#cp-p)">
          <g clipPath="url(#cp-s)">
            <circle cx="360" cy="305" r="148" fill="#1F4E79" fillOpacity="0.95" />
          </g>
        </g>

        {/* Circle strokes — rendered on top of fills */}
        <circle cx="300" cy="195" r="148" fill="none" stroke="#185FA5" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="420" cy="195" r="148" fill="none" stroke="#0F6E56" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="360" cy="305" r="148" fill="none" stroke="#854F0B" strokeOpacity="0.5" strokeWidth="1.5" />

        {/* Center label */}
        <text x="360" y="244" textAnchor="middle" fontSize="11" fontWeight="600" fill="white" fontFamily="sans-serif">A Great,</text>
        <text x="360" y="259" textAnchor="middle" fontSize="11" fontWeight="600" fill="white" fontFamily="sans-serif">Fulfilling</text>
        <text x="360" y="274" textAnchor="middle" fontSize="11" fontWeight="600" fill="white" fontFamily="sans-serif">Career</text>

        {/* Passions label */}
        <text x="238" y="138" textAnchor="middle" fontSize="15" fontWeight="600" fill="#185FA5" fontFamily="sans-serif">Passions</text>
        <text x="238" y="156" textAnchor="middle" fontSize="11" fill="#185FA5" fillOpacity="0.85" fontFamily="sans-serif">What charges</text>
        <text x="238" y="170" textAnchor="middle" fontSize="11" fill="#185FA5" fillOpacity="0.85" fontFamily="sans-serif">your battery</text>

        {/* Strengths label */}
        <text x="482" y="138" textAnchor="middle" fontSize="15" fontWeight="600" fill="#0F6E56" fontFamily="sans-serif">Strengths</text>
        <text x="482" y="156" textAnchor="middle" fontSize="11" fill="#0F6E56" fillOpacity="0.85" fontFamily="sans-serif">What others say</text>
        <text x="482" y="170" textAnchor="middle" fontSize="11" fill="#0F6E56" fillOpacity="0.85" fontFamily="sans-serif">you're great at</text>

        {/* Aspirations label */}
        <text x="360" y="390" textAnchor="middle" fontSize="15" fontWeight="600" fill="#854F0B" fontFamily="sans-serif">Aspirations</text>
        <text x="360" y="408" textAnchor="middle" fontSize="11" fill="#854F0B" fillOpacity="0.85" fontFamily="sans-serif">Your ideal Tuesday</text>
      </svg>

      {/* ── Mobile legend (visible below 640 px) ────────────────────────────── */}
      <div className="sm:hidden mt-5 flex flex-col gap-2 w-full max-w-xs">
        {LEGEND.map(({ id, bg, border, textColor }) => (
          <div key={id}>
            <button
              type="button"
              onClick={() => toggleMobile(id)}
              className="w-full flex items-center gap-3 py-1 text-left cursor-pointer"
            >
              <span
                className="shrink-0 w-4 h-4 rounded-full"
                style={{ backgroundColor: bg, border: `2px solid ${border}` }}
              />
              <span className="font-bold text-sm" style={{ color: textColor }}>
                {id}
              </span>
              <span className="ml-auto text-xs text-gray-400" aria-hidden="true">
                {mobileActive === id ? '▲' : 'ⓘ'}
              </span>
            </button>

            {/* Expanded definition panel */}
            {mobileActive === id && (
              <div className="mx-7 mt-1 mb-2 p-3 bg-[#1F4E79] text-white text-xs leading-relaxed rounded-lg">
                {DEFINITIONS[id]}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
