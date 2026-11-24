/*
  StockWaves mark: three stacked waves of increasing length, like stock on a
  shelf that grows. Flat, two colours, readable at favicon size.
  The top (longest) wave is the money line in teal; the rest use the text colour.
*/
export function LogoMark({ size = 28, animated = false, className = "" }) {
  return (
    <svg className={`logo-mark ${animated ? "is-animated" : ""} ${className}`} viewBox="0 0 32 32" width={size} height={size}
      fill="none" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className="lm-w w3" pathLength="1" d="M4 25.5q3-3.6 6 0" stroke="currentColor" />
      <path className="lm-w w2" pathLength="1" d="M4 17q3-3.6 6 0t6 0" stroke="currentColor" />
      <path className="lm-w w1" pathLength="1" d="M4 8.5q3-3.6 6 0t6 0 6 0 6 0" stroke="var(--teal)" />
    </svg>
  )
}

export function Wordmark({ size = 18 }) {
  return <span className="wordmark" style={{ fontSize: size }}>stockwaves</span>
}
