export default function GameAtmosphere() {
  return <div className="game-atmosphere" aria-hidden="true">
    <svg className="game-atmosphere-canopy" viewBox="0 0 1440 700" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
      <path d="M-240 590a960 960 0 0 1 1920 0M-180 590a900 900 0 0 1 1800 0" />
      <path d="m195 114 5 9 9 5-9 5-5 9-5-9-9-5 9-5 5-9Zm1050 0 5 9 9 5-9 5-5 9-5-9-9-5 9-5 5-9Z" />
      <circle cx="305" cy="59" r="2" /><circle cx="1135" cy="59" r="2" />
      <circle cx="88" cy="237" r="1.5" /><circle cx="1352" cy="237" r="1.5" />
    </svg>
    <svg className="game-atmosphere-mountains" viewBox="0 0 1440 260" preserveAspectRatio="none" focusable="false">
      <path className="game-mountain-far" d="M0 162 65 133 132 151 231 70 284 112 341 96 430 166 520 102 597 144 720 45 811 129 855 104 955 170 1054 91 1140 119 1247 59 1337 144 1390 120 1440 158V260H0Z" />
      <path className="game-mountain-near" d="M0 219 84 195 163 207 266 155 358 202 447 187 555 222 659 172 746 203 841 161 944 208 1038 186 1132 221 1240 148 1327 205 1440 182V260H0Z" />
      <path className="game-mountain-ridge" d="m173 151 58-81 53 42m338 55 98-122 91 84m350 5 86-75 90 85" />
    </svg>
  </div>
}
