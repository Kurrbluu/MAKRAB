type BackgroundDecorationProps = {
  variant?: 'default' | 'landing'
}

const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const

export default function BackgroundDecoration({ variant = 'default' }: BackgroundDecorationProps) {
  return (
    <div className={`home-decoration${variant === 'landing' ? ' home-decoration--landing' : ''}`} aria-hidden="true">
      {variant === 'landing' && (
        <>
          <span className="landing-haze" />
          {corners.map((corner) => (
            <svg key={corner} className={`landing-corner landing-corner--${corner}`} viewBox="0 0 72 72" fill="none" focusable="false">
              <path d="M2 70V2h68M12 54V12h42M22 38V22h16v16H22M2 54h10M54 2v10" />
            </svg>
          ))}
          {(['left', 'right'] as const).map((side) => (
            <svg key={side} className={`landing-cloud landing-cloud--${side}`} viewBox="0 0 360 260" fill="none" focusable="false">
              <path d="M-10 132h68c-19 0-32-12-32-28 0-17 14-30 32-30 10 0 18 4 24 11-4-29 17-51 43-51 25 0 44 19 44 42 0 20-14 35-32 35-13 0-22-9-22-20 0-9 7-17 16-17M58 132h157c22 0 37-13 37-31 0-18-14-31-32-31-13 0-23 9-23 21 0 8 6 15 14 15" />
              <path d="M-10 147h198c-17 0-29 12-29 27 0 16 12 28 28 28 11 0 20-8 20-18 0-8-6-14-13-14M188 147h76c-7-20 5-39 24-39 15 0 26 11 26 25 0 12-9 21-20 21h70M-10 220h90c-9-17 1-34 17-34 13 0 23 9 23 21 0 10-7 17-16 17h54" />
              <path d="M-10 51h34M-10 64h18M236 42h42M263 55h56M257 228h55M297 214h67" />
            </svg>
          ))}
        </>
      )}
      <span className="background-orbit background-orbit--outer" />
      <span className="background-orbit background-orbit--inner" />
    </div>
  )
}
