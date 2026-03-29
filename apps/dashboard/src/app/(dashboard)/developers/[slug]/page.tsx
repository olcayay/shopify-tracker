"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
import { Globe, Star } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { getPlatformLabel, getPlatformColor } from "@/lib/platform-display";

interface DeveloperApp {
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
}

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
  apps: DeveloperApp[];
  totalApps: number;
}

export default function CrossPlatformDeveloperPage() {
  const { slug } = useParams();
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<DeveloperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth(`/api/developers/${slug}`);
        if (res.ok) {
          setData(await res.json());
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

  const appsByPlatform = useMemo(() => {
    if (!data) return new Map<string, DeveloperApp[]>();
    const map = new Map<string, DeveloperApp[]>();
    for (const app of data.apps) {
      const list = map.get(app.platform) || [];
      list.push(app);
      map.set(app.platform, list);
    }
    return map;
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
      <div className="flex flex-wrap gap-2">
        {platforms.map((p) => (
          <Link key={p.id} href={`/${p.platform}/developers/${slug}`}>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              style={{ borderColor: getPlatformColor(p.platform) }}
            >
              <span
                className="w-2 h-2 rounded-full mr-1.5 inline-block"
                style={{ backgroundColor: getPlatformColor(p.platform) }}
              />
              {getPlatformLabel(p.platform)} ({p.appCount})
            </Badge>
          </Link>
        ))}
        <span className="text-sm text-muted-foreground self-center ml-2">
          {data.totalApps} app{data.totalApps !== 1 ? "s" : ""} across {platforms.length} platform{platforms.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Apps grouped by platform */}
      {Array.from(appsByPlatform.entries()).map(([platform, apps]) => {
        const hasInstalls = apps.some((a) => a.activeInstalls != null);
        return (
          <Card key={platform}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getPlatformColor(platform) }}
                />
                {getPlatformLabel(platform)}
                <span className="text-muted-foreground font-normal text-sm">
                  ({apps.length} {apps.length === 1 ? "app" : "apps"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">App</TableHead>
                    <TableHead className="text-right w-[80px]">Rating</TableHead>
                    <TableHead className="text-right w-[90px]">Reviews</TableHead>
                    <TableHead className="w-[160px]">Pricing</TableHead>
                    {hasInstalls && (
                      <TableHead className="text-right w-[100px]">Installs</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app) => (
                    <TableRow key={`${app.platform}-${app.slug}`}>
                      <TableCell className="min-w-[200px]">
                        <Link
                          href={`/${platform}/apps/${app.slug}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          {app.iconUrl && (
                            <img
                              src={app.iconUrl}
                              alt=""
                              className="w-6 h-6 rounded shrink-0"
                            />
                          )}
                          <span className="font-medium truncate max-w-[260px]">
                            {app.name}
                          </span>
                          {app.isTracked && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right w-[80px]">
                        {app.averageRating != null
                          ? app.averageRating.toFixed(1)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right w-[90px]">
                        {app.ratingCount != null
                          ? app.ratingCount.toLocaleString()
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="w-[160px] text-muted-foreground text-sm truncate max-w-[160px]">
                        {app.pricingHint || "-"}
                      </TableCell>
                      {hasInstalls && (
                        <TableCell className="text-right w-[100px]">
                          {app.activeInstalls != null
                            ? app.activeInstalls.toLocaleString()
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
