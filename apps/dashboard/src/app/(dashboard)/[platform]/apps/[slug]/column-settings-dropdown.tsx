"use client";

import { Button } from "@/components/ui/button";
import { Settings2, Check } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { SortKey } from "./competitors-section-types";

export function ColumnSettingsDropdown({
  appSlug,
  hiddenColumns,
  setHiddenColumns,
  visibleToggleableColumns,
  isCol,
  toggleColumn,
  sortKey,
  setSortKey,
  setSortDir,
}: {
  appSlug: string;
  hiddenColumns: Set<string>;
  setHiddenColumns: React.Dispatch<React.SetStateAction<Set<string>>>;
  visibleToggleableColumns: { key: string; label: string; tip?: string }[];
  isCol: (key: string) => boolean;
  toggleColumn: (key: string) => void;
  sortKey: SortKey;
  setSortKey: React.Dispatch<React.SetStateAction<SortKey>>;
  setSortDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
}) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 relative">
          <Settings2 className="h-4 w-4" />
          {hiddenColumns.size > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium leading-none px-1">
              {hiddenColumns.size}
            </span>
          )}
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          className="z-50 min-w-[200px] bg-popover border rounded-md shadow-md p-1 animate-in fade-in-0 zoom-in-95"
        >
          <DropdownMenuPrimitive.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Toggle columns
          </DropdownMenuPrimitive.Label>
          <div className="flex items-center gap-1 px-2 py-1">
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => {
                setHiddenColumns(new Set());
                localStorage.setItem(`competitors-columns-${appSlug}`, JSON.stringify([]));
              }}
            >
              Show all
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => {
                const allKeys = new Set(visibleToggleableColumns.map((c) => c.key));
                setHiddenColumns(allKeys);
                localStorage.setItem(`competitors-columns-${appSlug}`, JSON.stringify([...allKeys]));
                if (allKeys.has(sortKey)) {
                  setSortKey("order");
                  setSortDir("asc");
                }
              }}
            >
              Hide all
            </button>
          </div>
          <DropdownMenuPrimitive.Separator className="h-px bg-border my-1" />
          <div className="max-h-[300px] overflow-y-auto">
            {visibleToggleableColumns.map((col) => (
              <DropdownMenuPrimitive.CheckboxItem
                key={col.key}
                checked={isCol(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent focus:bg-accent"
              >
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {isCol(col.key) && <Check className="h-3 w-3" />}
                </span>
                {col.tip ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="border-b border-dotted border-muted-foreground/50">{col.label}</span>
                    </TooltipTrigger>
                    <TooltipContent side="left">{col.tip}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span>{col.label}</span>
                )}
              </DropdownMenuPrimitive.CheckboxItem>
            ))}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
