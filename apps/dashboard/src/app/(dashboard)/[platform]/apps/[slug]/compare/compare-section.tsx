"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppData } from "./compare-types";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function CompareSection({
  id,
  title,
  sectionKey,
  collapsed,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={id ? "scroll-mt-20" : undefined}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => onToggle(sectionKey)}
      >
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </div>
      </CardHeader>
      {!collapsed && <CardContent>{children}</CardContent>}
    </Card>
  );
}

export function VerticalListSection({
  id,
  title,
  sectionKey,
  collapsed,
  onToggle,
  apps,
  mainSlug,
  children,
  header,
}: {
  id?: string;
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
  mainSlug: string;
  children: (app: AppData) => React.ReactNode;
  header?: React.ReactNode;
}) {
  const { platform } = useParams();
  const version = useLayoutVersion();
  return (
    <CompareSection
      id={id}
      title={title}
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        {header}
        {apps.map((app) => (
          <div
            key={app.slug}
            className={cn(
              "flex items-start gap-3 p-2 rounded-md",
              app.slug === mainSlug && "bg-muted/50"
            )}
          >
            <Link href={buildAppLink(platform as string, app.slug, "", version)} title={app.name} className="shrink-0 mt-0.5">
              {app.iconUrl ? (
                <img
                  src={app.iconUrl}
                  alt={app.name}
                  className="h-6 w-6 rounded"
                />
              ) : (
                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold">
                  {app.name.charAt(0)}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">{children(app)}</div>
          </div>
        ))}
      </div>
    </CompareSection>
  );
}
