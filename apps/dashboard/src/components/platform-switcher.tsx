"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { extractSection } from "@/lib/nav-utils";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { Search } from "lucide-react";

export function PlatformSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, account } = useAuth();

  const enabledPlatforms = (
    user?.isSystemAdmin
      ? Object.keys(PLATFORMS)
      : account?.enabledPlatforms ?? []
  ) as PlatformId[];

  const filtered = enabledPlatforms.filter((pid) => {
    if (!query.trim()) return true;
    const d = PLATFORM_DISPLAY[pid];
    return (
      d.label.toLowerCase().includes(query.toLowerCase()) ||
      pid.includes(query.toLowerCase())
    );
  });

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Cmd+K listener — defer to CommandPalette when it's open
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // CommandPalette sets this attribute in capture phase; skip if present
        if (document.body.hasAttribute("data-command-palette-open")) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function navigate(pid: PlatformId) {
    const section = extractSection(pathname) || "overview";
    router.push(`/${pid}/${section}`);
    setOpen(false);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      navigate(filtered[selectedIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Palette */}
      <div
        className="relative w-full max-w-md bg-popover border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Switch platform..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              No platforms found
            </div>
          ) : (
            filtered.map((pid, i) => {
              const d = PLATFORM_DISPLAY[pid];
              const config = PLATFORMS[pid];
              return (
                <button
                  key={pid}
                  onClick={() => navigate(pid)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                    i === selectedIndex
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  }`}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {config.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
