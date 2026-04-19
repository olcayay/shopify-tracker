"use client";

import Link from "@/components/ui/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function AppIcon({
  app,
  selected,
  onClick,
  isMain,
  size = "md",
}: {
  app: { slug: string; name: string; iconUrl: string | null };
  selected: boolean;
  onClick?: () => void;
  isMain?: boolean;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="group relative flex flex-col items-center">
      <button
        onClick={onClick}
        disabled={isMain}
        className={cn(
          "relative rounded-lg transition-all shrink-0",
          sizeClass,
          selected
            ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
            : "opacity-35 hover:opacity-60 grayscale hover:grayscale-0",
          isMain && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background cursor-default"
        )}
      >
        {app.iconUrl ? (
          <img
            src={app.iconUrl}
            alt={app.name}
            className={cn("rounded-lg", sizeClass)}
          />
        ) : (
          <div
            className={cn(
              "rounded-lg bg-muted flex items-center justify-center text-xs font-bold",
              sizeClass
            )}
          >
            {app.name.charAt(0)}
          </div>
        )}
        {selected && !isMain && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </button>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {app.name}
      </span>
    </div>
  );
}

export function LinkedAppIcon({
  app,
}: {
  app: { slug: string; name: string; iconUrl: string | null };
}) {
  const { platform } = useParams();
  const version = useLayoutVersion();
  return (
    <Link
      href={buildAppLink(platform as string, app.slug, "", version)}
      className="group relative inline-flex flex-col items-center"
    >
      {app.iconUrl ? (
        <img
          src={app.iconUrl}
          alt={app.name}
          className="h-6 w-6 rounded"
        />
      ) : (
        <span className="text-xs font-bold">{app.name.charAt(0)}</span>
      )}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {app.name}
      </span>
    </Link>
  );
}
