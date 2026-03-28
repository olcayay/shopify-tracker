"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { CompareSection } from "./compare-section";
import { AppIcon } from "./app-icon";
import { CharBadge } from "./char-badge";
import { KeywordDensityTable } from "./keyword-density-table";
import type { AppData } from "./compare-types";

export function DetailsSection({
  id,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  activeDetailSlug,
  onActiveDetailSlugChange,
  detailsCharLimit,
  title,
}: {
  id?: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  activeDetailSlug: string;
  onActiveDetailSlugChange: (slug: string) => void;
  detailsCharLimit: number;
  title: string;
}) {
  const [draftDetails, setDraftDetails] = useState("");
  const [draftDetailsAnalyzed, setDraftDetailsAnalyzed] = useState("");
  const [draftDetailsOpen, setDraftDetailsOpen] = useState(false);

  return (
    <CompareSection
      id={id}
      title={title}
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {/* Test a new description — collapsible */}
      <div className="mb-4 border rounded-md">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={() => setDraftDetailsOpen((v) => !v)}
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
          Test a new description
          {draftDetailsOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
          )}
        </button>
        {draftDetailsOpen && (
          <div className="px-3 pb-3 space-y-3">
            <div>
              <div className="flex justify-end mb-1">
                <CharBadge count={draftDetails.length} max={detailsCharLimit} />
              </div>
              <textarea
                value={draftDetails}
                onChange={(e) => setDraftDetails(e.target.value.slice(0, detailsCharLimit))}
                maxLength={detailsCharLimit}
                placeholder="Test a new Description for your app!"
                className="w-full bg-muted/30 text-sm rounded-md border p-3 outline-none resize-none placeholder:text-muted-foreground/50 min-h-[120px]"
                rows={6}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setDraftDetailsAnalyzed(draftDetails)}
                disabled={draftDetails.trim().length === 0}
              >
                Analyze
              </Button>
              {draftDetailsAnalyzed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraftDetails("");
                    setDraftDetailsAnalyzed("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {draftDetailsAnalyzed && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                <p className="text-sm whitespace-pre-line border rounded-md p-3 bg-muted/20 max-h-[400px] overflow-auto">
                  {draftDetailsAnalyzed}
                </p>
                <KeywordDensityTable text={draftDetailsAnalyzed} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        {apps.map((app) => (
          <AppIcon
            key={app.slug}
            app={{
              slug: app.slug,
              name: app.name,
              iconUrl: app.iconUrl,
            }}
            selected={activeDetailSlug === app.slug}
            onClick={() => onActiveDetailSlugChange(app.slug)}
            size="sm"
            isMain={false}
          />
        ))}
      </div>
      {(() => {
        const active = apps.find(
          (a) => a.slug === activeDetailSlug
        );
        if (!active?.latestSnapshot?.appDetails) {
          return (
            <p className="text-sm text-muted-foreground">
              No app details available.
            </p>
          );
        }
        return (
          <div>
            <div className="flex justify-end">
              <CharBadge
                count={active.latestSnapshot.appDetails.length}
                max={detailsCharLimit}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
              <p className="text-sm whitespace-pre-line">
                {active.latestSnapshot.appDetails}
              </p>
              <KeywordDensityTable text={active.latestSnapshot.appDetails} />
            </div>
          </div>
        );
      })()}
    </CompareSection>
  );
}
