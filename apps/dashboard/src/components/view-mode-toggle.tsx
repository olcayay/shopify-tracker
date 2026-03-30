"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { LayoutList, Group } from "lucide-react";

export type ViewMode = "list" | "grouped";

interface ViewModeToggleProps {
  /** Current view mode (controlled) */
  viewMode: ViewMode;
  /** Called when the user clicks a toggle button */
  onChangeViewMode: (mode: ViewMode) => void;
}

function readStoredMode(key: string): ViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(key);
  return stored === "grouped" ? "grouped" : "list";
}

export function useViewMode(storageKey: string, onChange?: (mode: ViewMode) => void) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredMode(storageKey));

  // Sync from localStorage on mount (handles SSR hydration)
  useEffect(() => {
    setViewMode(readStoredMode(storageKey));
  }, [storageKey]);

  const changeViewMode = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      localStorage.setItem(storageKey, mode);
      onChange?.(mode);
    },
    [storageKey, onChange],
  );

  return { viewMode, changeViewMode } as const;
}

export function ViewModeToggle({ viewMode, onChangeViewMode }: ViewModeToggleProps) {

  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        variant={viewMode === "list" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChangeViewMode("list")}
        title="Flat list"
      >
        <LayoutList className="h-3.5 w-3.5 mr-1" />
        List
      </Button>
      <Button
        variant={viewMode === "grouped" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChangeViewMode("grouped")}
        title="Group by platform"
      >
        <Group className="h-3.5 w-3.5 mr-1" />
        By Platform
      </Button>
    </div>
  );
}
