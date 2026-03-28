"use client";

interface AnimatedLogoProps {
  animating?: boolean;
  className?: string;
}

export function AnimatedLogo({ animating = false, className = "" }: AnimatedLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`w-5 h-5 ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @keyframes bar-bounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.5); }
        }
      `}</style>
      {/* Bar 1 (short) */}
      <rect
        x="3"
        y="14"
        width="5"
        height="8"
        rx="1"
        fill="currentColor"
        style={animating ? {
          transformOrigin: "3px 22px",
          animation: "bar-bounce 0.6s ease-in-out infinite",
          animationDelay: "0ms",
        } : undefined}
      />
      {/* Bar 2 (medium) */}
      <rect
        x="10"
        y="8"
        width="5"
        height="14"
        rx="1"
        fill="currentColor"
        style={animating ? {
          transformOrigin: "10px 22px",
          animation: "bar-bounce 0.6s ease-in-out infinite",
          animationDelay: "150ms",
        } : undefined}
      />
      {/* Bar 3 (tall) */}
      <rect
        x="17"
        y="2"
        width="5"
        height="20"
        rx="1"
        fill="currentColor"
        style={animating ? {
          transformOrigin: "17px 22px",
          animation: "bar-bounce 0.6s ease-in-out infinite",
          animationDelay: "300ms",
        } : undefined}
      />
    </svg>
  );
}
