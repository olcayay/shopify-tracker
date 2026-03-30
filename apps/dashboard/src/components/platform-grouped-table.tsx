"use client";

import { useState, useCallback, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PLATFORM_DISPLAY, getPlatformColor } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";

export interface PlatformGroup<T> {
  platform: string;
  items: T[];
}

interface PlatformGroupedTableProps<T> {
  /** Ordered array of platform groups */
  groups: PlatformGroup<T>[];
  /** Total number of columns (used for colSpan on group headers) */
  colCount: number;
  /** Render column headers (inside <TableHeader>) */
  renderHeaderRow: () => ReactNode;
  /** Render a single data row */
  renderRow: (item: T, index: number) => ReactNode;
  /** Singular entity label for count display (default: "item") */
  entityLabel?: string;
  /** Show column headers only once at top (true) or repeat per group (false, default) */
  singleHeader?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

export function PlatformGroupedTable<T>({
  groups,
  colCount,
  renderHeaderRow,
  renderRow,
  entityLabel = "item",
  singleHeader = true,
  emptyMessage = "No items found.",
}: PlatformGroupedTableProps<T>) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = useCallback((platform: string) => {
    setCollapsed((prev) => ({ ...prev, [platform]: !prev[platform] }));
  }, []);

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (totalItems === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border rounded-md">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        {singleHeader && (
          <TableHeader>
            <TableRow>{renderHeaderRow()}</TableRow>
          </TableHeader>
        )}
        <TableBody>
          {groups.map((group) => {
            const color = getPlatformColor(group.platform as PlatformId);
            const label =
              PLATFORM_DISPLAY[group.platform as PlatformId]?.label ??
              group.platform;
            const isCollapsed = collapsed[group.platform] ?? false;
            const plural =
              group.items.length !== 1 ? `${entityLabel}s` : entityLabel;

            return (
              <PlatformGroupRows
                key={group.platform}
                group={group}
                color={color}
                label={label}
                plural={plural}
                colCount={colCount}
                isCollapsed={isCollapsed}
                onToggle={() => toggleCollapse(group.platform)}
                renderHeaderRow={singleHeader ? undefined : renderHeaderRow}
                renderRow={renderRow}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Internal helper — renders one platform group's header + rows */
function PlatformGroupRows<T>({
  group,
  color,
  label,
  plural,
  colCount,
  isCollapsed,
  onToggle,
  renderHeaderRow,
  renderRow,
}: {
  group: PlatformGroup<T>;
  color: string;
  label: string;
  plural: string;
  colCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  renderHeaderRow?: () => ReactNode;
  renderRow: (item: T, index: number) => ReactNode;
}) {
  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <>
      {/* Platform group header row */}
      <TableRow
        className="hover:bg-muted/30 cursor-pointer border-b"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
        onClick={onToggle}
        data-testid={`platform-group-${group.platform}`}
      >
        <TableCell colSpan={colCount} className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ChevronIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">
              ({group.items.length} {plural})
            </span>
          </div>
        </TableCell>
      </TableRow>
      {/* Per-group column headers (when singleHeader is false) */}
      {!isCollapsed && renderHeaderRow && (
        <TableRow className="bg-muted/30">
          {renderHeaderRow()}
        </TableRow>
      )}
      {/* Data rows */}
      {!isCollapsed && group.items.map((item, i) => renderRow(item, i))}
    </>
  );
}
