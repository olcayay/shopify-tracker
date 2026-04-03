"use client";

import { useRef, useEffect, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

interface VirtualizedListProps<T> {
  items: T[];
  /** Height of each row in pixels */
  rowHeight: number;
  /** Max visible height before scrolling (default: 600) */
  maxHeight?: number;
  /** Minimum items before virtualization kicks in (default: 50) */
  threshold?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional className for the container */
  className?: string;
}

/**
 * Virtualized list using react-window FixedSizeList.
 * Falls back to regular rendering when item count < threshold.
 */
export function VirtualizedList<T>({
  items,
  rowHeight,
  maxHeight = 600,
  threshold = 50,
  renderItem,
  className,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Below threshold: render normally
  if (items.length < threshold) {
    return (
      <div className={className}>
        {items.map((item, i) => renderItem(item, i))}
      </div>
    );
  }

  const listHeight = Math.min(items.length * rowHeight, maxHeight);

  const Row = ({ index, style }: ListChildComponentProps) => (
    <div style={style}>{renderItem(items[index], index)}</div>
  );

  return (
    <div ref={containerRef} className={className}>
      {width > 0 && (
        <FixedSizeList
          height={listHeight}
          itemCount={items.length}
          itemSize={rowHeight}
          width={width}
        >
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}
