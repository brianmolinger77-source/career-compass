import React, { useState } from 'react'

// ── Geometry constants ───────────────────────────────────────────────────────
const CX = 195   // circle center x
const CY = 200   // circle center y
const R1 = 155   // Passions (outermost)
const R2 = 112   // Strengths
const R3 = 75    // Aspirations
const R4 = 52    // Bullseye — "Your Best Work"

// Callout label y-intercepts (staggered so labels don't overlap)
const PY = 145   // Passions callout y
const SY = 180   // Strengths callout y
const AY = 218   // Aspirations callout y

// x where each ring's right edge intersects its callout y-level
// formula: cx + √(r² − (cy − y)²)
const passionsEdgeX    = Math.round(CX + Math.sqrt(R1 * R1 - (CY - PY) ** 2))  // 340
const strengthsEdgeX   = Math.round(CX + Math.sqrt(R2 * R2 - (CY - SY) ** 2))  // 305
const aspirationsEdgeX = Math.round(CX + Math.sqrt(R3 * R3 - (CY - AY) ** 2))  // 268

const CALLOUT_END_X = 360   // where every callout line terminates
const LABEL_X       = 365   // where label text begins

// Foundation bar — exactly as wide as the outer circle, butted beneath it
const BAR_X      = CX - R1   // 40
const BAR_W      = R1 * 2    // 310
const BAR_CX     = CX        // 195 — centre for text anchors
const BAR_Y      = CY + R1   // 355 — bottom of outer circle = top of bar (no gap)
const BAR_H      = 64        // tall enough for two lines of text
const SVG_H      = BAR_Y + BAR_H + 5   // 424

// ── Ring tooltip definitions ─────────────────────────────────────────────────
const DEFINITIONS = {
  Passions:
    "The activities and actions that charge your battery — the work that energizes you, that you'd do beyond what's required. Be honest here, not aspirational. A passion isn't what you think you should enjoy. It's what actually lights you up.",
  Strengths:
    "Something a colleague, supervisor, or teammate has told you that you're good at — in a performance review, in feedback, or just in passing. Strengths are externally validated, not self-declared. And critically: a strength is not necessarily something you enjoy.",
  Aspirations:
    "The conditions in which you do your best work. Close your eyes and picture an ideal Tuesday at work. Where are you? Who's around you? What's the pace? Are you leading, building, solving, advising? Identify the environment where your strengths and passions are most likely to thrive together.",
}

// Legend items for the mobile view
const LEGEND = [
  { id: 'Passions',       bg: '#EBF3FB', border: '#1F4E79', textColor: '#1F4E79' },
  { id: 'Strengths',      bg: '#FDF0E8', border: '#C65911', textColor: '#C65911' },
  { id: 'Aspirations',    bg: '#F5F5F5', border: '#888888', textColor: '#555555' },
  { id: 'Your Best Work', bg: '#1F4E79', border: '#1F4E79', textColor: '#1F4E79', noTip: true,
    sublabel: 'Where fulfillment lives' },
]

// ── Component ────────────────────────────────────────────────────────────────
export default function VennDiagram() {
  const [tooltip, setTooltip]         = useState(null)  // { id, x, y }
  const [mobileActive, setMobileActive] = useState(null) // id of expanded definition

  function showTip(id, e) { setTooltip({ id, x: e.clientX, y: e.clientY }) }
  function moveTip(id, e) { setTooltip({ id, x: e.clientX, y: e.clientY }) }
  function hideTip()      { setTooltip(null) }

  function toggleMobile(id) {
    setMobileActive(prev => (prev === id ? null : id))
  }

  // Position tooltip to the left of cursor, above the cursor
  function tipStyle(x, y) {
    return {
      position: 'fixed',
      top:  y - 15,
      left: x - 295,                    // 280px wide + 15px gap
      transform: 'translateY(-100%)',
      animation: 'tipFadeIn 0.15s ease-out',
      zIndex: 50,
    }
  }

  return (
    <div className="flex flex-col items-center py-6 px-4 relative">
      {/* Keyframe for tooltip fade-in */}
      <style>{`
        @keyframes tipFadeIn {
          from { opacity: 0; transform: translateY(calc(-100% + 6px)); }
          to   { opacity: 1; transform: translateY(-100%); }
        }
      `}</style>

      {/* ── SVG diagram ─────────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 540 ${SVG_H}`}
        className="w-full max-w-[540px]"
        aria-label="Bullseye diagram: Passions, Strengths, and Aspirations rings converging on Your Best Work at the centre"
        overflow="visible"
      >
        {/* Rings — painted outermost→innermost so each inner ring occludes the last */}
        <circle cx={CX} cy={CY} r={R1} fill="#EBF3FB" stroke="#1F4E79" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={R2} fill="#FDF0E8" stroke="#C65911" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={R3} fill="#F5F5F5" stroke="#888888" strokeWidth="2" />

        {/* Bullseye */}
        <circle cx={CX} cy={CY} r={R4} fill="#1F4E79" />
        <text
          x={CX} y={CY - 9}
          textAnchor="middle" dominantBaseline="auto"
          fontSize="10.5" fontWeight="800" fill="white" fontFamily="sans-serif"
        >
          Your Best Work
        </text>
        <text
          x={CX} y={CY + 8}
          textAnchor="middle" dominantBaseline="auto"
          fontSize="8" fill="white" fontFamily="sans-serif"
        >
          Where fulfillment lives
        </text>

        {/* ── Callout labels (desktop only: hidden below 640 px) ────────────── */}
        <g className="hidden sm:block">

          {/* Passions */}
          <g
            style={{ cursor: 'help' }}
            onMouseEnter={e => showTip('Passions', e)}
            onMouseMove={e  => moveTip('Passions', e)}
            onMouseLeave={hideTip}
          >
            <line
              x1={passionsEdgeX} y1={PY} x2={CALLOUT_END_X} y2={PY}
              stroke="#1F4E79" strokeWidth="1.5"
            />
            <text
              x={LABEL_X} y={PY}
              dominantBaseline="middle"
              fontSize="13" fontWeight="700" fill="#1F4E79" fontFamily="sans-serif"
            >
              Passions
            </text>
            {/* Transparent hit-area so the hover zone is generous */}
            <rect x={passionsEdgeX} y={PY - 12} width={LABEL_X - passionsEdgeX + 68} height="24" fill="transparent" />
          </g>

          {/* Strengths */}
          <g
            style={{ cursor: 'help' }}
            onMouseEnter={e => showTip('Strengths', e)}
            onMouseMove={e  => moveTip('Strengths', e)}
            onMouseLeave={hideTip}
          >
            <line
              x1={strengthsEdgeX} y1={SY} x2={CALLOUT_END_X} y2={SY}
              stroke="#C65911" strokeWidth="1.5"
            />
            <text
              x={LABEL_X} y={SY}
              dominantBaseline="middle"
              fontSize="13" fontWeight="700" fill="#C65911" fontFamily="sans-serif"
            >
              Strengths
            </text>
            <rect x={strengthsEdgeX} y={SY - 12} width={LABEL_X - strengthsEdgeX + 74} height="24" fill="transparent" />
          </g>

          {/* Aspirations */}
          <g
            style={{ cursor: 'help' }}
            onMouseEnter={e => showTip('Aspirations', e)}
            onMouseMove={e  => moveTip('Aspirations', e)}
            onMouseLeave={hideTip}
          >
            <line
              x1={aspirationsEdgeX} y1={AY} x2={CALLOUT_END_X} y2={AY}
              stroke="#888888" strokeWidth="1.5"
            />
            <text
              x={LABEL_X} y={AY}
              dominantBaseline="middle"
              fontSize="13" fontWeight="700" fill="#555555" fontFamily="sans-serif"
            >
              Aspirations
            </text>
            <rect x={aspirationsEdgeX} y={AY - 12} width={LABEL_X - aspirationsEdgeX + 82} height="24" fill="transparent" />
          </g>
        </g>

        {/* ── Foundation bar ───────────────────────────────────────────────── */}
        {/* Exact width of outer circle, centred beneath it, flush to circle bottom */}
        <rect x={BAR_X} y={BAR_Y} width={BAR_W} height={BAR_H} fill="#1F4E79" />

        {/* Two-line bar text, centred horizontally */}
        <text
          x={BAR_CX} y={BAR_Y + 22}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="13" fontWeight="700" fill="white" fontFamily="sans-serif"
          letterSpacing="0.5"
        >
          Table Stakes
        </text>
        <text
          x={BAR_CX} y={BAR_Y + 44}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="9.5" fill="white" fontStyle="italic" fontFamily="sans-serif"
        >
          Your non-negotiables — the foundation everything rests on
        </text>
      </svg>

      {/* ── Mobile legend (visible below 640 px) ────────────────────────────── */}
      <div className="sm:hidden mt-5 flex flex-col gap-2 w-full max-w-xs">
        {LEGEND.map(({ id, bg, border, textColor, noTip, sublabel }) => (
          <div key={id}>
            <button
              type="button"
              disabled={noTip}
              onClick={() => !noTip && toggleMobile(id)}
              className={`w-full flex items-center gap-3 py-1 text-left ${noTip ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className="shrink-0 w-4 h-4 rounded-full"
                style={{ backgroundColor: bg, border: `2px solid ${border}` }}
              />
              <span className="font-bold text-sm" style={{ color: textColor }}>
                {id}
                {sublabel && (
                  <span className="font-normal text-xs ml-1 opacity-70">— {sublabel}</span>
                )}
              </span>
              {!noTip && (
                <span className="ml-auto text-xs text-gray-400" aria-hidden="true">
                  {mobileActive === id ? '▲' : 'ⓘ'}
                </span>
              )}
            </button>

            {/* Expanded definition panel */}
            {!noTip && mobileActive === id && (
              <div className="mx-7 mt-1 mb-2 p-3 bg-[#1F4E79] text-white text-xs leading-relaxed rounded-lg">
                {DEFINITIONS[id]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Desktop tooltip (fixed, pointer-events-none) ─────────────────────── */}
      {tooltip && DEFINITIONS[tooltip.id] && (
        <div
          className="max-w-[280px] rounded-lg bg-[#1F4E79] px-4 py-3 text-xs leading-relaxed text-white shadow-xl pointer-events-none"
          style={tipStyle(tooltip.x, tooltip.y)}
        >
          <p className="font-semibold mb-1">{tooltip.id}</p>
          {DEFINITIONS[tooltip.id]}
        </div>
      )}
    </div>
  )
}
