"use client";

interface VirtualizedListProps<T> {
  items: T[];
  /** Max visible height before scrolling (default: 600px) */
  maxHeight?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional className for the container */
  className?: string;
}

/**
 * Scrollable list container with a max height.
 * For large lists, limits the visible area and enables scrolling.
 * CSS `content-visibility: auto` enables browser-native lazy rendering.
 */
export function VirtualizedList<T>({
  items,
  maxHeight = 600,
  renderItem,
  className,
}: VirtualizedListProps<T>) {
  return (
    <div
      className={className}
      style={{ maxHeight, overflowY: "auto", contentVisibility: "auto" } as React.CSSProperties}
    >
      {items.map((item, i) => renderItem(item, i))}
    </div>
  );
}
