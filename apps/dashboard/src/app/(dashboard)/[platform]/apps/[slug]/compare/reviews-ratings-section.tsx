"use client";

import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import type { AppData } from "./compare-types";
import { formatNumber } from "@/lib/format-utils";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - (star - 1)));
        return (
          <div key={star} className="relative h-4 w-4">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-muted-foreground/30"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-yellow-500"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReviewsRatingsSection({
  id,
  sectionKey,
  collapsed,
  onToggle,
  apps,
}: {
  id?: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
}) {
  const hasAnyRatings = apps.some(
    (a) => a.latestSnapshot?.averageRating != null
  );
  if (!hasAnyRatings) return null;

  return (
    <CompareSection
      id={id}
      title="Reviews and Ratings"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]" />
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px]">
                Average rating
              </td>
              {apps.map((app) => {
                const rating = app.latestSnapshot?.averageRating
                  ? Number(app.latestSnapshot.averageRating)
                  : null;
                return (
                  <td key={app.slug} className="py-2 px-2 text-center">
                    {rating != null ? (
                      <div className="flex flex-col items-center gap-1">
                        <StarRating rating={rating} />
                        <span className="font-bold">{rating}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="border-b last:border-0">
              <td className="py-2 pr-4 text-muted-foreground font-medium">
                Ratings number
              </td>
              {apps.map((app) => {
                const count = app.latestSnapshot?.ratingCount;
                return (
                  <td key={app.slug} className="py-2 px-2 text-center">
                    {count != null ? (
                      <span className="font-bold">
                        {formatNumber(count)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
