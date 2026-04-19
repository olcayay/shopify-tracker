"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, Star, Bookmark } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { getPlatformLabel, getPlatformColor } from "@/lib/platform-display";
import { formatNumber } from "@/lib/format-utils";
import { displayPricingModel } from "@/lib/pricing-display";

interface DeveloperProfile {
  developer: {
    id: number;
    slug: string;
    name: string;
    website: string | null;
  };
  platforms: {
    id: number;
    platform: string;
    name: string;
    appCount: number;
  }[];
  apps: {
    id: number;
    platform: string;
    slug: string;
    name: string;
    iconUrl: string | null;
    averageRating: number | null;
    ratingCount: number | null;
    pricingHint: string | null;
    isTracked: boolean;
    activeInstalls: number | null;
  }[];
  totalApps: number;
  isStarred: boolean;
}

export default function CrossPlatformDeveloperPage() {
  const { slug } = useParams();
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<DeveloperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth(`/api/developers/${slug}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setStarred(json.isStarred ?? false);
        } else {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Developer not found");
        }
      } catch {
        setError("Failed to load developer");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  async function toggleStar() {
    if (!data) return;
    const prev = starred;
    setStarred(!prev);
    try {
      const method = prev ? "DELETE" : "POST";
      const res = await fetchWithAuth(`/api/account/starred-developers/${data.developer.id}`, { method });
      if (!res.ok) throw new Error();
    } catch {
      setStarred(prev);
    }
  }

  const appsByPlatform = useMemo(() => {
    if (!data) return new Map<string, DeveloperProfile["apps"]>();
    const map = new Map<string, DeveloperProfile["apps"]>();
    for (const app of data.apps) {
      const list = map.get(app.platform) || [];
      list.push(app);
      map.set(app.platform, list);
    }
    return map;
  }, [data]);

  const hasInstalls = useMemo(() => {
    if (!data) return false;
    return data.apps.some((a) => a.activeInstalls != null);
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Developer Not Found</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const { developer, platforms } = data;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <p className="text-sm text-muted-foreground">
        <Link href="/developers" className="hover:underline">
          Developers
        </Link>
        {" > "}
        {developer.name}
      </p>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{developer.name}</h1>
        <button
          onClick={toggleStar}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label={starred ? "Remove bookmark" : "Bookmark developer"}
        >
          <Bookmark
            className={`h-5 w-5 ${
              starred
                ? "fill-amber-500 text-amber-500"
                : "text-muted-foreground hover:text-amber-500"
            }`}
          />
        </button>
        {developer.website && (
          <a
            href={developer.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">
          <strong className="text-foreground">{data.totalApps} apps</strong> across{" "}
          <strong className="text-foreground">{platforms.length} platforms</strong>
        </span>
        <div className="flex gap-1.5">
          {platforms.map((p) => (
            <Link key={p.id} href={`/${p.platform}/developers/${slug}`}>
              <Badge
                variant="outline"
                className="text-[10px] cursor-pointer hover:bg-muted"
                style={{ borderColor: getPlatformColor(p.platform) }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mr-1 inline-block"
                  style={{ backgroundColor: getPlatformColor(p.platform) }}
                />
                {getPlatformLabel(p.platform)} ({p.appCount})
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Apps grouped by platform */}
      {platforms.map((p) => {
        const platformApps = appsByPlatform.get(p.platform) || [];

        return (
          <Card key={p.platform}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getPlatformColor(p.platform) }}
                />
                <Link
                  href={`/${p.platform}/developers/${slug}`}
                  className="hover:underline"
                >
                  {getPlatformLabel(p.platform)}
                </Link>
                <span className="text-muted-foreground font-normal text-sm">
                  ({platformApps.length} {platformApps.length === 1 ? "app" : "apps"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformApps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No apps found on {getPlatformLabel(p.platform)}.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App</TableHead>
                      <TableHead className="text-right w-28">Rating</TableHead>
                      <TableHead className="text-right w-28">Reviews</TableHead>
                      <TableHead className="text-right w-48">Pricing</TableHead>
                      {hasInstalls && (
                        <TableHead className="text-right w-32">Installs</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platformApps.map((app) => (
                      <TableRow key={`${app.platform}-${app.slug}`}>
                        <TableCell>
                          <Link
                            href={`/${app.platform}/apps/${app.slug}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            {app.iconUrl && (
                              <img
                                src={app.iconUrl}
                                alt="" aria-hidden="true"
                                className="w-6 h-6 rounded shrink-0"
                              />
                            )}
                            <span className="font-medium truncate">
                              {app.name}
                            </span>
                            {app.isTracked && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          {app.averageRating != null
                            ? app.averageRating.toFixed(1)
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.ratingCount != null
                            ? formatNumber(app.ratingCount)
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm truncate">
                          {displayPricingModel(app.pricingHint)}
                        </TableCell>
                        {hasInstalls && (
                          <TableCell className="text-right">
                            {app.activeInstalls != null
                              ? formatNumber(app.activeInstalls)
                              : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
