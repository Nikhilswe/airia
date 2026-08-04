interface AiriaLogoProps {
  size?: number
  animate?: boolean
  glow?: boolean
  showWordmark?: boolean
}

export function AiriaLogo({ size = 96, animate = false, glow = true, showWordmark = false }: AiriaLogoProps) {
  const w = showWordmark ? size * 1.8 : size
  const h = size

  return (
    <svg
      width={w}
      height={h}
      viewBox={showWordmark ? '0 0 180 100' : '0 0 100 100'}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="img"
      aria-label="AIrIA"
    >
      {animate && (
        <style>{`
          @keyframes airia-ping { 0%{r:10;opacity:0.6} 100%{r:46;opacity:0} }
          @keyframes airia-node { 0%,100%{opacity:1} 50%{opacity:0.55} }
          @keyframes airia-conn { 0%,100%{opacity:0.3} 50%{opacity:0.65} }
          @keyframes airia-dot  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }
          .al-ping { animation: airia-ping 3s ease-out infinite; }
          .al-node { animation: airia-node 3s ease-in-out infinite; }
          .al-conn { animation: airia-conn 4s ease-in-out infinite; }
          .al-dot  { animation: airia-dot 3s ease-in-out infinite; transform-origin:50px 22px; }
        `}</style>
      )}

      <defs>
        {glow && (
          <filter id="al-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
        <filter id="al-strong" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="al-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Ambient halo behind i-dot */}
      <circle cx="50" cy="22" r="18" fill="url(#al-halo)"/>

      {/* Signal ring from i-dot */}
      <circle
        className={animate ? 'al-ping' : undefined}
        cx="50" cy="22" r={animate ? undefined : '30'}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.8"
        opacity={animate ? undefined : '0.15'}
      />

      {/* Constellation connections */}
      <g className={animate ? 'al-conn' : undefined} opacity={animate ? undefined : '0.3'}>
        {/* A: feet → crossbar nodes */}
        <line x1="18" y1="88" x2="38" y2="62" stroke="var(--accent)" strokeWidth="0.7"/>
        <line x1="82" y1="88" x2="62" y2="62" stroke="var(--accent)" strokeWidth="0.7"/>
        {/* A: feet → apex */}
        <line x1="18" y1="88" x2="50" y2="18" stroke="var(--accent)" strokeWidth="0.7"/>
        <line x1="82" y1="88" x2="50" y2="18" stroke="var(--accent)" strokeWidth="0.7"/>
        {/* Crossbar */}
        <line x1="38" y1="62" x2="62" y2="62" stroke="var(--accent)" strokeWidth="0.7"/>
        {/* Floating satellites off apex */}
        <line x1="50" y1="18" x2="32" y2="6"  stroke="var(--accent)" strokeWidth="0.5" opacity="0.5"/>
        <line x1="50" y1="18" x2="68" y2="6"  stroke="var(--accent)" strokeWidth="0.5" opacity="0.5"/>
      </g>

      {/* A letterform strokes */}
      <g filter={glow ? 'url(#al-glow)' : undefined}>
        <path d="M18,88 L50,18 L82,88" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="34" y1="64" x2="66" y2="64" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
      </g>

      {/* Constellation nodes */}
      <g className={animate ? 'al-node' : undefined} filter={glow ? 'url(#al-glow)' : undefined}>
        <circle cx="18"  cy="88" r="3"   fill="var(--accent)" opacity="0.85"/>
        <circle cx="82"  cy="88" r="3"   fill="var(--accent)" opacity="0.85"/>
        <circle cx="50"  cy="18" r="3.5" fill="var(--accent)"/>
        <circle cx="38"  cy="62" r="2.5" fill="var(--accent)" opacity="0.75"/>
        <circle cx="62"  cy="62" r="2.5" fill="var(--accent)" opacity="0.75"/>
        <circle cx="32"  cy="6"  r="1.8" fill="var(--accent)" opacity="0.5"/>
        <circle cx="68"  cy="6"  r="1.8" fill="var(--accent)" opacity="0.5"/>
      </g>

      {/* i-dot — glowing core */}
      <circle cx="50" cy="22" r="14" fill="url(#al-halo)" filter="url(#al-strong)"/>
      <g className={animate ? 'al-dot' : undefined} filter="url(#al-strong)">
        <circle cx="50" cy="22" r="5.5" fill="var(--accent)"/>
      </g>

      {/* Wordmark */}
      {showWordmark && (
        <g filter={glow ? 'url(#al-glow)' : undefined}>
          <line x1="100" y1="28" x2="100" y2="72" stroke="var(--accent)" strokeWidth="0.5" opacity="0.2"/>
          <text
            x="140" y="58"
            fontFamily="'SF Pro Display','Helvetica Neue',system-ui,sans-serif"
            fontSize="22" fontWeight="300" letterSpacing="5"
            fill="var(--accent)" opacity="0.9" textAnchor="middle"
          >AIrIA</text>
          <text
            x="140" y="72"
            fontFamily="'SF Pro Display','Helvetica Neue',system-ui,sans-serif"
            fontSize="6" fontWeight="300" letterSpacing="3.5"
            fill="var(--accent)" opacity="0.4" textAnchor="middle"
          >PERSONAL AI</text>
        </g>
      )}
    </svg>
  )
}
