"use client";

import { CompareSection } from "./compare-section";
import type { AppData } from "./compare-types";
import { ExternalLink } from "@/components/ui/external-link";

export function WixFeaturedSection({
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
  return (
    <CompareSection
      id={id}
      title="Featured In"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
      <table className="w-max text-sm table-auto">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground w-8">#</th>
            {apps.map((app) => (
              <th key={app.slug} className="text-left py-2 px-2 font-medium">
                {app.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            const allCollections = new Set<string>();
            for (const app of apps) {
              const cols = (app.latestSnapshot?.platformData as any)?.collections ?? [];
              for (const c of cols) allCollections.add(c.name);
            }
            return Array.from(allCollections).map((name, i) => (
              <tr key={name} className="border-b last:border-0">
                <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                {apps.map((app) => {
                  const cols: { slug: string; name: string }[] = (app.latestSnapshot?.platformData as any)?.collections ?? [];
                  const found = cols.find((c) => c.name === name);
                  return (
                    <td key={app.slug} className="py-2 px-2 align-top">
                      {found ? (
                        <ExternalLink
                          href={`https://www.wix.com/app-market/collection/${found.slug}`}
                          showIcon={false}
                          className="text-primary"
                        >
                          {found.name}
                        </ExternalLink>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ));
          })()}
        </tbody>
      </table>
      </div>
    </CompareSection>
  );
}
