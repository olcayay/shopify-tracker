"use client";

import { useState } from "react";

interface Props {
  count: number;
  total: number;
  names: string[];
  className?: string;
}

/**
 * Displays (count/total) with a hover tooltip listing competitor names.
 * Uses state-based hover to render a fixed-position tooltip that won't be clipped.
 */
export function CompetitorCountBadge({ count, total, names, className }: Props) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  if (names.length === 0) {
    return (
      <span className={`text-xs text-muted-foreground shrink-0 ${className || ""}`}>
        ({count}/{total})
      </span>
    );
  }

  function handleEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Position above the element, right-aligned
    setPos({ x: rect.right, y: rect.top });
    setShow(true);
  }

  return (
    <>
      <span
        className={`text-xs text-muted-foreground shrink-0 cursor-default ${className || ""}`}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => e.stopPropagation()}
      >
        ({count}/{total})
      </span>
      {show && pos && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: pos.y - 4,
            left: pos.x,
            transform: "translate(-100%, -100%)",
          }}
        >
          <div className="rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground shadow-lg max-w-[220px]">
            {names.map((name) => (
              <div key={name} className="leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis">{name}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
