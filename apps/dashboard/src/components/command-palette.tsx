"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Command } from "cmdk";
import { Search, BarChart3, Key, Globe, Settings, Home } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface SearchResult {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  group: string;
}

const PAGES: SearchResult[] = [
  { id: "overview", label: "Overview", href: "/overview", icon: <Home className="h-4 w-4" />, group: "Pages" },
  { id: "apps", label: "Tracked Apps", href: "/apps", icon: <BarChart3 className="h-4 w-4" />, group: "Pages" },
  { id: "competitors", label: "Competitors", href: "/competitors", icon: <Globe className="h-4 w-4" />, group: "Pages" },
  { id: "settings", label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" />, group: "Pages" },
  { id: "pricing", label: "Pricing", href: "/pricing", icon: <BarChart3 className="h-4 w-4" />, group: "Pages" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [appResults, setAppResults] = useState<SearchResult[]>([]);
  const { fetchWithAuth } = useAuth();
  const router = useRouter();
  const params = useParams();
  const platform = (params.platform as string) || "shopify";
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cmd+K opens the palette (unless keyword search modal is open)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Don't hijack if a modal is already open
        const hasOpenModal = document.querySelector("[data-keyword-search-open]");
        if (hasOpenModal) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search apps when query changes
  const searchApps = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 2) {
        setAppResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetchWithAuth(
            `/api/apps?platform=${platform}&search=${encodeURIComponent(q)}&limit=5`
          );
          if (res.ok) {
            const data = await res.json();
            const items = (data.items || data.apps || []).slice(0, 5);
            setAppResults(
              items.map((app: any) => ({
                id: `app-${app.slug}`,
                label: app.name || app.slug,
                href: `/${platform}/apps/${app.slug}`,
                icon: <BarChart3 className="h-4 w-4" />,
                group: "Apps",
              }))
            );
          }
        } catch {
          /* ignore */
        }
      }, 300);
    },
    [fetchWithAuth, platform]
  );

  useEffect(() => {
    searchApps(query);
  }, [query, searchApps]);

  if (!open) return null;

  const allResults = [...PAGES, ...appResults];

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-lg border bg-background shadow-lg overflow-hidden"
          shouldFilter={appResults.length === 0}
        >
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search apps, pages..."
              className="flex h-10 w-full bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {["Pages", "Apps"].map((group) => {
              const items = allResults.filter((r) => r.group === group);
              if (items.length === 0) return null;
              return (
                <Command.Group key={group} heading={group} className="px-1 py-1.5 text-xs font-medium text-muted-foreground">
                  {items.map((result) => (
                    <Command.Item
                      key={result.id}
                      value={result.label}
                      onSelect={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(result.href);
                      }}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                    >
                      {result.icon}
                      {result.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
