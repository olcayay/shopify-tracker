"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle } from "lucide-react";
import { MARKETPLACE_LIST } from "@/lib/marketplace-list";

export function PlatformRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { fetchWithAuth, account } = useAuth();
  const [platformName, setPlatformName] = useState("");
  const [marketplaceUrl, setMarketplaceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const enabledPlatforms = account?.enabledPlatforms ?? [];

  const suggestions = useMemo(() => {
    // Filter out platforms already enabled for the account
    const available = MARKETPLACE_LIST.filter(
      (m) => !m.platformId || !enabledPlatforms.includes(m.platformId)
    );

    if (!platformName.trim()) return available;

    const query = platformName.toLowerCase();
    return available.filter((m) =>
      m.name.toLowerCase().includes(query)
    );
  }, [platformName, enabledPlatforms]);

  const exactMatch = suggestions.some(
    (m) => m.name.toLowerCase() === platformName.trim().toLowerCase()
  );

  function reset() {
    setPlatformName("");
    setMarketplaceUrl("");
    setNotes("");
    setSubmitted(false);
    setError(null);
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!platformName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/account/platform-requests", {
        method: "POST",
        body: JSON.stringify({
          platformName: platformName.trim(),
          marketplaceUrl: marketplaceUrl.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to submit request");
      }
    } catch {
      setError("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function selectSuggestion(name: string) {
    setPlatformName(name);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-6">
        <SheetTitle className="text-lg font-semibold mb-2">
          Request a Platform
        </SheetTitle>
        <p className="text-sm text-muted-foreground mb-6">
          Tell us which marketplace you&apos;d like us to support.
        </p>

        {submitted ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">Thank you!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              We&apos;ve received your platform request. We&apos;ll review it
              and let you know when it&apos;s available.
            </p>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="text-sm font-medium mb-1.5 block">
                Platform Name <span className="text-destructive">*</span>
              </label>
              <Input
                ref={inputRef}
                placeholder="Search marketplaces..."
                value={platformName}
                onChange={(e) => {
                  setPlatformName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                required
                autoComplete="off"
              />
              {showSuggestions && (suggestions.length > 0 || platformName.trim()) && (
                <div
                  ref={listRef}
                  className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto"
                >
                  {suggestions.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => selectSuggestion(m.name)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                        m.name.toLowerCase() === platformName.trim().toLowerCase()
                          ? "bg-muted font-medium"
                          : ""
                      }`}
                    >
                      {m.name}
                      {m.platformId && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Supported
                        </span>
                      )}
                    </button>
                  ))}
                  {platformName.trim() && !exactMatch && (
                    <button
                      type="button"
                      onClick={() => selectSuggestion(platformName.trim())}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-t text-muted-foreground"
                    >
                      Use custom: &ldquo;{platformName.trim()}&rdquo;
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Marketplace URL
              </label>
              <Input
                placeholder="e.g., https://monday.com/marketplace"
                value={marketplaceUrl}
                onChange={(e) => setMarketplaceUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Notes
              </label>
              <textarea
                placeholder="Why would this platform be useful for you?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !platformName.trim()}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
