"use client";

import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import { CharBadge } from "./char-badge";
import type { AppData } from "./compare-types";

export function FeaturesSection({
  id,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  isSalesforce,
  isWix,
  featureCharLimit,
}: {
  id?: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  isSalesforce: boolean;
  isWix: boolean;
  featureCharLimit: number;
}) {
  return (
    <CompareSection
      id={id}
      title={isSalesforce ? "Highlights" : isWix ? "Benefits" : "Features"}
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                #
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({
              length: Math.max(
                ...apps.map(
                  (a) => a.latestSnapshot?.features?.length || 0
                )
              ),
            }).map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 pr-4 text-muted-foreground align-top w-[160px] min-w-[160px]">
                  {i + 1}
                </td>
                {apps.map((app) => {
                  const feat = app.latestSnapshot?.features?.[i];
                  if (!feat) return <td key={app.slug} className="py-2 px-2 align-top" />;
                  if (isSalesforce) {
                    const [title, ...rest] = feat.split("\n");
                    const description = rest.join("\n").trim();
                    return (
                      <td key={app.slug} className="py-2 px-2 align-top">
                        <div>
                          <span className="font-semibold">{title}</span>
                          {description && (
                            <p className="text-muted-foreground mt-0.5">{description}</p>
                          )}
                          <div className="mt-1 flex justify-end">
                            <CharBadge count={feat.length} max={featureCharLimit} />
                          </div>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={app.slug}
                      className="py-2 px-2 align-top"
                    >
                      <div>
                        <span>{feat}</span>
                        <div className="mt-1 flex justify-end">
                          <CharBadge count={feat.length} max={featureCharLimit} />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
