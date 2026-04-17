"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import type { AppData } from "./compare-types";

export function PermissionsComparisonSection({
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
  // Build map: scope → { appSlug → type }
  const permissionMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const app of apps) {
      const perms: { scope: string; type: string }[] =
        app.latestSnapshot?.platformData?.permissions || [];
      for (const p of perms) {
        if (!map.has(p.scope)) map.set(p.scope, new Map());
        map.get(p.scope)!.set(app.slug, p.type);
      }
    }
    return map;
  }, [apps]);

  // Sort: most common scopes first, then alphabetically
  const allScopes = useMemo(() => {
    return [...permissionMap.keys()].sort((a, b) => {
      const aCount = permissionMap.get(a)?.size || 0;
      const bCount = permissionMap.get(b)?.size || 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.localeCompare(b);
    });
  }, [permissionMap]);

  if (allScopes.length === 0) return null;

  const formatScope = (scope: string) =>
    scope.replace(/^canva:/, "").replace(/:/g, " › ");

  return (
    <CompareSection
      id={id}
      title="Permissions"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
        <table className="w-max text-sm table-auto">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[200px] min-w-[200px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_var(--border)]">
                Permission
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 text-center w-[200px] min-w-[200px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_var(--border)]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allScopes.map((scope) => {
              const appMap = permissionMap.get(scope)!;
              return (
                <tr key={scope} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 w-[200px] min-w-[200px]">
                    <Badge variant="outline" className="text-xs">
                      {formatScope(scope)} ({appMap.size})
                    </Badge>
                  </td>
                  {apps.map((app) => {
                    const type = appMap.get(app.slug);
                    if (!type) return <td key={app.slug} className="py-1.5 px-2 text-center" />;
                    return (
                      <td key={app.slug} className="py-1.5 px-2 text-center">
                        <Badge
                          variant={type === "MANDATORY" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {type === "MANDATORY" ? "Required" : "Optional"}
                        </Badge>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
