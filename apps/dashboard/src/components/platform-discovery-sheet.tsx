"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { Check, Search, MessageSquarePlus } from "lucide-react";
import { PlatformRequestDialog } from "@/components/platform-request-dialog";

const CAPABILITY_LABELS: { key: string; label: string }[] = [
  { key: "hasReviews", label: "Reviews" },
  { key: "hasKeywordSearch", label: "Keywords" },
  { key: "hasFeaturedSections", label: "Featured" },
  { key: "hasAdTracking", label: "Ads" },
  { key: "hasSimilarApps", label: "Similar" },
  { key: "hasFeatureTaxonomy", label: "Features" },
  { key: "hasPricing", label: "Pricing" },
  { key: "hasLaunchedDate", label: "Launch Date" },
];

export function PlatformDiscoverySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { account, fetchWithAuth, refreshUser } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const [search, setSearch] = useState("");
  const [enabling, setEnabling] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const filtered = PLATFORM_IDS.filter((pid) => {
    if (!search.trim()) return true;
    const d = PLATFORM_DISPLAY[pid];
    return d.label.toLowerCase().includes(search.toLowerCase());
  });

  async function enablePlatform(pid: PlatformId) {
    setEnabling(pid);
    try {
      const res = await fetchWithAuth("/api/account/platforms", {
        method: "POST",
        body: JSON.stringify({ platform: pid }),
      });
      if (res.ok) {
        await refreshUser();
      }
    } finally {
      setEnabling(null);
    }
  }

  async function disablePlatform(pid: PlatformId) {
    setDisabling(pid);
    try {
      const res = await fetchWithAuth(`/api/account/platforms/${pid}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await refreshUser();
      }
    } finally {
      setDisabling(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
          <SheetTitle className="text-lg font-semibold mb-1">
            Platform Catalog
          </SheetTitle>
          <p className="text-sm text-muted-foreground mb-4">
            {PLATFORM_IDS.length} platforms available &middot;{" "}
            {enabledPlatforms.length} enabled
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search platforms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Platform list */}
          <div className="space-y-3">
            {filtered.map((pid) => {
              const d = PLATFORM_DISPLAY[pid];
              const config = PLATFORMS[pid];
              const isEnabled = enabledPlatforms.includes(pid);
              const capabilities = CAPABILITY_LABELS.filter(
                (c) => (config as Record<string, unknown>)[c.key] === true
              );

              return (
                <div
                  key={pid}
                  className={`border rounded-lg p-3 transition-colors ${
                    isEnabled ? "border-l-4" : "border-dashed opacity-80"
                  }`}
                  style={isEnabled ? { borderLeftColor: d.color } : undefined}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="font-medium text-sm">{d.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {config.name}
                    </span>
                  </div>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {capabilities.map((cap) => (
                      <span
                        key={cap.key}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      >
                        {cap.label}
                      </span>
                    ))}
                  </div>

                  {/* Action */}
                  {isEnabled ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Active
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => disablePlatform(pid)}
                        disabled={disabling === pid}
                      >
                        {disabling === pid ? "Disabling..." : "Disable"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => enablePlatform(pid)}
                      disabled={enabling === pid}
                    >
                      {enabling === pid ? "Enabling..." : "Enable Platform"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Request a Platform */}
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Missing a platform?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestOpen(true)}
            >
              <MessageSquarePlus className="h-4 w-4 mr-1.5" />
              Request a Platform
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PlatformRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
      />
    </>
  );
}
