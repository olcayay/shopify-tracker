"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface ScraperOptions {
  pages?: "first" | "all" | number;
  scrapeAppDetails?: boolean;
  scrapeReviews?: boolean;
}

interface ScraperOptionsModalProps {
  open: boolean;
  scraperType: string;
  label: string;
  onConfirm: (options: ScraperOptions) => void;
  onCancel: () => void;
}

export function ScraperOptionsModal({
  open,
  scraperType,
  label,
  onConfirm,
  onCancel,
}: ScraperOptionsModalProps) {
  const [pagesMode, setPagesMode] = useState<"first" | "number" | "all">("first");
  const [pagesCount, setPagesCount] = useState(4);
  const [scrapeAppDetails, setScrapeAppDetails] = useState(false);
  const [scrapeReviews, setScrapeReviews] = useState(false);

  if (!open) return null;

  const isListScraper = scraperType === "category" || scraperType === "keyword_search";
  const isDetailScraper = scraperType === "app_details";

  function handleConfirm() {
    const options: ScraperOptions = {};

    if (isListScraper) {
      if (pagesMode === "first") options.pages = "first";
      else if (pagesMode === "all") options.pages = "all";
      else options.pages = pagesCount;

      if (scrapeAppDetails) {
        options.scrapeAppDetails = true;
        if (scrapeReviews) options.scrapeReviews = true;
      }
    }

    if (isDetailScraper && scrapeReviews) {
      options.scrapeReviews = true;
    }

    onConfirm(options);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold">Scraper Options</h3>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>

        <div className="mt-4 space-y-4">
          {/* Pages option for list scrapers */}
          {isListScraper && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pages to scrape</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pages"
                    checked={pagesMode === "first"}
                    onChange={() => setPagesMode("first")}
                    className="accent-primary"
                  />
                  First page only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pages"
                    checked={pagesMode === "number"}
                    onChange={() => setPagesMode("number")}
                    className="accent-primary"
                  />
                  Number of pages
                  {pagesMode === "number" && (
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={pagesCount}
                      onChange={(e) => setPagesCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="w-16 h-7 px-2 text-sm border rounded bg-background"
                    />
                  )}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pages"
                    checked={pagesMode === "all"}
                    onChange={() => setPagesMode("all")}
                    className="accent-primary"
                  />
                  All pages
                </label>
              </div>
            </div>
          )}

          {/* Cascade: scrape app details */}
          {isListScraper && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={scrapeAppDetails}
                  onChange={(e) => {
                    setScrapeAppDetails(e.target.checked);
                    if (!e.target.checked) setScrapeReviews(false);
                  }}
                  className="accent-primary"
                />
                Also scrape app details for found apps
              </label>
              {scrapeAppDetails && (
                <label className="flex items-center gap-2 text-sm cursor-pointer ml-6">
                  <input
                    type="checkbox"
                    checked={scrapeReviews}
                    onChange={(e) => setScrapeReviews(e.target.checked)}
                    className="accent-primary"
                  />
                  Also scrape reviews
                </label>
              )}
            </div>
          )}

          {/* Cascade: scrape reviews for detail scraper */}
          {isDetailScraper && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={scrapeReviews}
                onChange={(e) => setScrapeReviews(e.target.checked)}
                className="accent-primary"
              />
              Also scrape reviews
            </label>
          )}

          {/* Simple confirmation for reviews / digest */}
          {!isListScraper && !isDetailScraper && (
            <p className="text-sm text-muted-foreground">
              This will start the scraper with default settings.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Start Scraper
          </Button>
        </div>
      </div>
    </div>
  );
}
