"use client";

interface AnimatedLogoProps {
  animating?: boolean;
  className?: string;
}

/**
 * Bar chart icon with X/Y axes and 4 animated bars.
 * Bars grow/shrink with staggered timing when `animating` is true.
 */
export function AnimatedLogo({ animating = false, className = "" }: AnimatedLogoProps) {
  // Axis baseline: Y-axis at x=3, X-axis at y=21
  // Chart area: x 5..23, y 2..21
  // 4 bars with gap=1, width=3.5 each → total 4*3.5 + 3*1 = 17 fits in 18px
  const bars = [
    { x: 5.5,  height: 7,  delay: "0ms" },
    { x: 10,   height: 14, delay: "400ms" },
    { x: 14.5, height: 10, delay: "800ms" },
    { x: 19,   height: 17, delay: "1200ms" },
  ];

  const barWidth = 3.5;
  const baseline = 19.5;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`w-5 h-5 ${className}`}
      aria-hidden="true"
    >
      <defs>
        {bars.map((bar, i) => (
          <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        ))}
      </defs>

      <style>{`
        @keyframes chart-bar-grow {
          0%, 40%, 100% { transform: scaleY(1); }
          20% { transform: scaleY(0.35); }
        }
      `}</style>

      {/* Y-axis */}
      <line x1="4" y1="2" x2="4" y2="21.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* X-axis */}
      <line x1="3.5" y1="21.5" x2="23" y2="21.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />

      {/* Bars */}
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={baseline - bar.height}
          width={barWidth}
          height={bar.height}
          rx="0.8"
          fill={`url(#bar-grad-${i})`}
          style={animating ? {
            transformOrigin: `${bar.x + barWidth / 2}px ${baseline}px`,
            animation: "chart-bar-grow 3s ease-in-out infinite",
            animationDelay: bar.delay,
          } : undefined}
        />
      ))}
    </svg>
  );
}
