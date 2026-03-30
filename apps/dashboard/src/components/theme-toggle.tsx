"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const THEMES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <div className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground">
        <Sun className="h-4 w-4" />
      </div>
    );
  }

  const currentIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const Icon = currentIcon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        <Icon className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-md border bg-popover p-1 shadow-md">
            {THEMES.map(({ value, icon: ThemeIcon, label }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${
                  theme === value
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <ThemeIcon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
