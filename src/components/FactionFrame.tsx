const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const
const constellationPatterns: Record<string, { line: string; stars: [number, number][] }> = {
  'azure-dragon': { line: 'M10 61 22 43 45 39 58 23 79 27 96 13M45 39 64 60 90 66', stars: [[10, 61], [22, 43], [45, 39], [58, 23], [79, 27], [96, 13], [64, 60], [90, 66]] },
  'vermilion-bird': { line: 'M10 18 25 27 40 45 57 56 70 38 91 25 103 13M57 56 52 78', stars: [[10, 18], [25, 27], [40, 45], [57, 56], [70, 38], [91, 25], [103, 13], [52, 78]] },
  'white-tiger': { line: 'M10 41 27 26 43 31 60 17 87 23 100 45 86 65 63 60M43 31 47 53 27 68', stars: [[10, 41], [27, 26], [43, 31], [60, 17], [87, 23], [100, 45], [86, 65], [63, 60], [47, 53], [27, 68]] },
  'black-tortoise': { line: 'M12 56 30 26 58 15 85 32 96 57 63 70 31 66 12 56M30 26 63 70M85 32 31 66', stars: [[12, 56], [30, 26], [58, 15], [85, 32], [96, 57], [63, 70], [31, 66]] },
}

export default function FactionFrame({ faction }: { faction?: string }) {
  const constellation = faction ? constellationPatterns[faction] : undefined
  return <span className="faction-frame" aria-hidden="true">
    {corners.map(corner => <svg key={corner} className={`faction-frame-corner faction-frame-corner--${corner}`} viewBox="0 0 24 24" fill="none" focusable="false">
      <path d="M2 22V2h20M6 16V6h10M2 16h4M16 2v4" />
    </svg>)}
    {constellation && <svg className="faction-frame-constellation" viewBox="0 0 112 88" fill="none" focusable="false">
      <path d={constellation.line} />
      {constellation.stars.map(([x, y], index) => <g key={index}>
        {index === 3 && <circle className="constellation-star-halo" cx={x} cy={y} r="5" />}
        <circle className="constellation-star" cx={x} cy={y} r={index === 3 ? 2 : 1.5} />
      </g>)}
    </svg>}
    <svg className="faction-frame-cloud" viewBox="0 0 180 110" fill="none" focusable="false">
      <path d="M-8 56h35c-11 0-19-7-19-16s8-17 19-17c6 0 11 2 15 6-2-17 10-29 25-29 15 0 26 11 26 25 0 12-8 21-19 21-8 0-13-5-13-12 0-5 4-10 10-10M27 56h77c14 0 23-8 23-19s-8-18-19-18c-8 0-14 6-14 13 0 5 4 9 8 9M-8 67h109c-11 0-18 8-18 17s7 17 17 17c7 0 12-5 12-11 0-5-4-9-8-9M101 67h29c-4-12 3-23 14-23 9 0 16 7 16 15s-5 12-12 12h40" />
    </svg>
  </span>
}
