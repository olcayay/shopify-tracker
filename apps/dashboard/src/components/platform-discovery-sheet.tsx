"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { Check, Search, MessageSquarePlus, ArrowRight } from "lucide-react";
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

function PlatformCard({
  pid,
  isEnabled,
  onNavigate,
}: {
  pid: PlatformId;
  isEnabled: boolean;
  onNavigate: () => void;
}) {
  const d = PLATFORM_DISPLAY[pid];
  const config = PLATFORMS[pid];
  const capabilities = CAPABILITY_LABELS.filter(
    (c) => (config as Record<string, unknown>)[c.key] === true
  );

  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        isEnabled ? "border-l-4" : "border-dashed opacity-60"
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

      {/* Status */}
      {isEnabled ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="h-3 w-3" /> Active
          </span>
          <Link href={`/${pid}`} onClick={onNavigate}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              Dashboard <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          Not enabled for this account
        </span>
      )}
    </div>
  );
}

function AvailablePlatformRow({
  pid,
  onNavigate,
}: {
  pid: PlatformId;
  onNavigate: () => void;
}) {
  const d = PLATFORM_DISPLAY[pid];

  return (
    <Link
      href={`/${pid}`}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: d.color }}
      />
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
        {d.label}
      </span>
      <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}

export function PlatformDiscoverySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, account } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const isSystemAdmin = user?.isSystemAdmin;
  const [search, setSearch] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);

  // Regular users only see their enabled platforms; system admin sees all
  const visiblePlatforms = isSystemAdmin ? PLATFORM_IDS : enabledPlatforms;

  const filtered = visiblePlatforms.filter((pid) => {
    if (!search.trim()) return true;
    const d = PLATFORM_DISPLAY[pid];
    return d.label.toLowerCase().includes(search.toLowerCase());
  });

  // Split into tracked (enabled) and available (not enabled, admin-only)
  const tracked = filtered.filter((pid) => enabledPlatforms.includes(pid));
  const available = filtered.filter((pid) => !enabledPlatforms.includes(pid));

  const handleNavigate = () => onOpenChange(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto p-6">
          <SheetTitle className="text-lg font-semibold mb-1">
            {isSystemAdmin ? "All Platforms" : "Your Platforms"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mb-4">
            {tracked.length} platform{tracked.length !== 1 ? "s" : ""} tracked
            {isSystemAdmin && ` · ${PLATFORM_IDS.length} total`}
          </p>

          {/* Search */}
          {visiblePlatforms.length > 3 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search platforms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Tracked Platforms */}
          {tracked.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tracked Platforms
              </h3>
              {tracked.map((pid) => (
                <PlatformCard
                  key={pid}
                  pid={pid}
                  isEnabled={true}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

          {/* Available Platforms (admin-only: not enabled for this account) */}
          {available.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Available Platforms
                </h3>
                <div className="flex-1 border-t border-dashed" />
                <span className="text-xs text-muted-foreground">{available.length}</span>
              </div>
              {available.map((pid) => (
                <AvailablePlatformRow
                  key={pid}
                  pid={pid}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

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
