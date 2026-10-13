import type { TimerId } from '../data/timers'

export function PhaseDisplayFrame() {
  return <>
    <svg className="phase-display-frame" viewBox="0 0 400 44" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 1h376l11 11v20l-11 11H12L1 32V12L12 1Z" vectorEffect="non-scaling-stroke" />
      <path className="phase-display-inner-frame" d="M18 5h364m0 34H18M5 17v10m390-10v10" vectorEffect="non-scaling-stroke" />
    </svg>
    {['left', 'right'].map(side => <svg key={side} className={`phase-display-ornament phase-display-ornament--${side}`} viewBox="0 0 48 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 12h10l6-6 6 6-6 6-6-6m12 0h6m4 0h12M18 9v6" />
      <circle cx="32" cy="12" r="1" />
    </svg>)}
    <svg className="phase-display-caret" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false"><path d="m3 4.5 3 3 3-3" /></svg>
  </>
}

export function PhaseSigil({ phase, className = '' }: { phase: TimerId; className?: string }) {
  return <svg className={`phase-sigil ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    {phase === 'terawang' ? <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4 4l1.5 1.5m13 13L20 20M20 4l-1.5 1.5m-13 13L4 20" />
    </> : phase === 'discussion' ? <>
      <path d="M4 4h12a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-5 4v-4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
      <path d="M19 8h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3v3l-4-3h-6M6 8h8M6 11h5" />
    </> : <>
      <path d="M2 7h19m-5-5 5 5-5 5M22 17H3m5-5-5 5 5 5" />
      <circle cx="3" cy="7" r="1" /><circle cx="21" cy="17" r="1" />
    </>}
  </svg>
}

export function PhaseJourney({ phase }: { phase: TimerId }) {
  const steps = [
    { id: 'terawang', label: 'Terawang' },
    { id: 'discussion', label: 'Diskusi' },
    { id: 'movement', label: 'Exchange' },
  ] as const
  return <ol className="phase-journey" aria-label="Alur setiap ronde">
    {steps.map(step => <li key={step.id} data-phase={step.id} className={phase === step.id ? 'is-active' : ''} aria-current={phase === step.id ? 'step' : undefined} aria-label={step.label}>
      <span className="phase-journey-node"><PhaseSigil phase={step.id} /><span className="phase-journey-label">{step.label}</span></span>
    </li>)}
  </ol>
}

export function PhasePanelArtwork() {
  return <span className="phase-panel-artwork" aria-hidden="true">
    {['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(corner => <svg key={corner} className={`phase-panel-corner phase-panel-corner--${corner}`} viewBox="0 0 42 42" fill="none" focusable="false">
      <path d="M2 40V10a8 8 0 0 1 8-8h30M8 32V14a6 6 0 0 1 6-6h18M8 25h6V14h11M2 18h6M18 2v6" />
      <path d="m27 15 3 3-3 3-3-3 3-3Z" />
    </svg>)}
    <svg className="phase-panel-crown" viewBox="0 0 200 24" fill="none" focusable="false">
      <path d="M5 12h56m8 0h13l8-6 10 6 10-6 8 6h13m8 0h56M93 12l7 6 7-6" />
      <circle cx="65" cy="12" r="1.5" /><circle cx="135" cy="12" r="1.5" />
    </svg>
  </span>
}

export function TimerEngraving({ phase }: { phase: TimerId }) {
  return <>
    <svg className="timer-engraving" viewBox="0 0 320 320" fill="none" aria-hidden="true" focusable="false">
      <circle cx="160" cy="160" r="156" pathLength="100" strokeDasharray="8 17" transform="rotate(-59 160 160)" className="timer-engraving-orbit" />
      <circle cx="160" cy="160" r="135" className="timer-engraving-inner" />
      {Array.from({ length: 60 }, (_, index) => <path key={index} className={index % 5 === 0 ? 'timer-engraving-major' : undefined}
        d={`M160 18v${index % 5 === 0 ? 11 : 4}`} transform={`rotate(${index * 6} 160 160)`} />)}
      {[0, 90, 180, 270].map(angle => <path key={angle} className="timer-engraving-cardinal" d="m160 2 3 4-3 4-3-4 3-4Z" transform={`rotate(${angle} 160 160)`} />)}
    </svg>
    <PhaseSigil phase={phase} className="timer-phase-emblem" />
    <svg className="timer-dial-flourish" viewBox="0 0 108 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M1 7h35m7 0h5l6-5 6 5h5m7 0h35M48 7l6 5 6-5" />
      <circle cx="40" cy="7" r="1" /><circle cx="68" cy="7" r="1" />
    </svg>
  </>
}
