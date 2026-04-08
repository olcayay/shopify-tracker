"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PLATFORMS, isPlatformId } from "@appranks/shared";

interface SearchResult {
  slug: string;
  name: string;
  iconUrl: string | null;
  platform: string;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
}

export function AuditSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(
          `${apiUrl}/api/public/apps/search?q=${encodeURIComponent(query)}&limit=8`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setIsOpen(data.length > 0);
        }
      } catch {
        // ignore fetch errors
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectApp(app: SearchResult) {
    setIsOpen(false);
    setQuery(app.name);
    router.push(`/audit/${app.platform}/${app.slug}`);
  }

  return (
    <div ref={wrapperRef} className="relative max-w-xl mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your app by name..."
            className="pl-10 h-12 text-base"
            onFocus={() => results.length > 0 && setIsOpen(true)}
          />
        </div>
        <Button size="lg" className="h-12 px-6" disabled={results.length === 0}>
          Audit Now
        </Button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((app) => {
            const platformConfig = isPlatformId(app.platform) ? PLATFORMS[app.platform] : null;
            return (
              <button
                key={`${app.platform}:${app.slug}`}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left transition-colors"
                onClick={() => selectApp(app)}
              >
                {app.iconUrl ? (
                  <img
                    src={app.iconUrl}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{app.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{platformConfig?.name || app.platform}</span>
                    {app.averageRating && (
                      <span>
                        {"\u2605"} {Number(app.averageRating).toFixed(1)}
                      </span>
                    )}
                    {app.pricingHint && <span>{app.pricingHint}</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              Searching...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
