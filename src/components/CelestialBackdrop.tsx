import type { CSSProperties } from 'react'

const scenery = `${import.meta.env.BASE_URL}scenery/celestial-garden-v2.webp`

const fireflies = [
  [8, 27, 0, 9], [16, 62, -4, 11], [25, 80, -7, 10], [34, 17, -2, 13],
  [46, 86, -6, 12], [56, 10, -3, 11], [68, 77, -8, 14], [75, 30, -5, 10],
  [85, 67, -1, 12], [92, 20, -9, 13], [11, 85, -6, 14], [89, 88, -3, 9],
]

function MistLayer({ depth }: { depth: 'far' | 'middle' | 'near' }) {
  const gradient = `garden-mist-color-${depth}`
  const softness = `garden-mist-softness-${depth}`

  return (
    <svg className={`garden-mist garden-mist--${depth}`} viewBox="0 0 1600 300" preserveAspectRatio="none" fill="none" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b6dcd5" stopOpacity="0" />
          <stop offset="0.48" stopColor="#c5e6dd" stopOpacity="0.45" />
          <stop offset="0.73" stopColor="#91c8c6" stopOpacity="0.25" />
          <stop offset="1" stopColor="#79afb0" stopOpacity="0" />
        </linearGradient>
        <filter id={softness} x="-10%" y="-40%" width="120%" height="180%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <g fill={`url(#${gradient})`} filter={`url(#${softness})`}>
        <path d="M-100 147c96-19 121-41 190-26 79 18 114-28 180-37 87-14 126 47 204 45 89-1 128-53 219-46 85 6 104 49 189 50 120 1 145-44 230-30 93 15 103 52 187 39 83-14 115-58 187-54 91 5 134 52 231 40v168H-100V147Z" />
        <path d="M-100 211c107-47 154-50 259-36 99 14 141 17 234-9 126-36 166-33 264-6 101 28 142 35 234 18 110-20 168-55 260-44 116 14 139 64 234 57 91-6 158-27 282-19v120H-100v-81Z" />
      </g>
    </svg>
  )
}

export default function CelestialBackdrop() {
  return (
    <div className="celestial-garden" aria-hidden="true">
      <img className="garden-scene" src={scenery} alt="" width="1672" height="941" decoding="async" fetchPriority="high" draggable={false} />
      {(['left', 'right'] as const).map(side => (
        <span className={`garden-edge garden-edge--${side}`} key={side}>
          <img src={scenery} alt="" width="1672" height="941" decoding="async" draggable={false} />
        </span>
      ))}
      <span className="garden-color-wash" />
      <MistLayer depth="far" />
      <MistLayer depth="middle" />
      <MistLayer depth="near" />
      {fireflies.map(([left, top, delay, duration], index) => (
        <span key={index} className="garden-firefly" style={{ left: `${left}%`, top: `${top}%`, '--firefly-delay': `${delay}s`, '--firefly-duration': `${duration}s` } as CSSProperties} />
      ))}
    </div>
  )
}
