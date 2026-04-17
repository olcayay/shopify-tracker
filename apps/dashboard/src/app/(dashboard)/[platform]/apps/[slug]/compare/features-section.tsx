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
      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
        <table className="w-max text-sm table-auto">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[180px] min-w-[180px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_var(--border)]">
                #
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 w-[200px] min-w-[200px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_var(--border)]">
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
                <td className="py-2 pr-4 text-muted-foreground align-top w-[180px] min-w-[180px]">
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
                        <div className="whitespace-normal break-words">
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
                      <div className="whitespace-normal break-words">
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
