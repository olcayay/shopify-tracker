"use client";

import { useEffect, useState } from "react";
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
import { Globe, ExternalLink, Star } from "lucide-react";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { TableSkeleton } from "@/components/skeletons";

const PLATFORM_COLORS: Record<string, string> = {
  shopify: "#95BF47",
  salesforce: "#00A1E0",
  canva: "#00C4CC",
  wix: "#0C6EFC",
  wordpress: "#21759B",
  google_workspace: "#4285F4",
  atlassian: "#0052CC",
  zoom: "#0B5CFF",
  zoho: "#D4382C",
  zendesk: "#03363D",
  hubspot: "#FF7A59",
};

const PLATFORM_LABELS: Record<string, string> = {
  shopify: "Shopify",
  salesforce: "Salesforce",
  canva: "Canva",
  wix: "Wix",
  wordpress: "WordPress",
  google_workspace: "Google Workspace",
  atlassian: "Atlassian",
  zoom: "Zoom",
  zoho: "Zoho",
  zendesk: "Zendesk",
  hubspot: "HubSpot",
};

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
}

export default function DeveloperProfilePage() {
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

  const { developer, platforms, apps } = data;

  // Group apps by platform
  const appsByPlatform = new Map<string, typeof apps>();
  for (const app of apps) {
    const list = appsByPlatform.get(app.platform) || [];
    list.push(app);
    appsByPlatform.set(app.platform, list);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin/developers" className="hover:underline">
            Developers
          </Link>
          {" > "}
          {developer.name}
        </p>
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
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">
            {data.totalApps} apps across {platforms.length} platform{platforms.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Platform badges */}
      <div className="flex flex-wrap gap-2">
        {platforms.map((p) => (
          <Badge
            key={p.id}
            variant="outline"
            className="text-xs"
            style={{ borderColor: PLATFORM_COLORS[p.platform] || "#666" }}
          >
            <span
              className="w-2 h-2 rounded-full mr-1.5 inline-block"
              style={{ backgroundColor: PLATFORM_COLORS[p.platform] || "#666" }}
            />
            {PLATFORM_LABELS[p.platform] || p.platform}
            <span className="text-muted-foreground ml-1">
              ({p.appCount} {p.appCount === 1 ? "app" : "apps"})
            </span>
            {p.name !== developer.name && (
              <span className="text-muted-foreground ml-1">as &ldquo;{p.name}&rdquo;</span>
            )}
          </Badge>
        ))}
      </div>

      {/* Apps table per platform */}
      {Array.from(appsByPlatform.entries()).map(([platform, platformApps]) => (
        <Card key={platform}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PLATFORM_COLORS[platform] || "#666" }}
              />
              {PLATFORM_LABELS[platform] || platform}
              <span className="text-muted-foreground font-normal text-sm">
                ({platformApps.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead>Pricing</TableHead>
                  {platformApps.some((a) => a.activeInstalls != null) && (
                    <TableHead className="text-right">Installs</TableHead>
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
                            alt=""
                            className="w-6 h-6 rounded"
                          />
                        )}
                        <span className="font-medium">{app.name}</span>
                        {app.isTracked && (
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {app.averageRating != null ? app.averageRating.toFixed(1) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {app.ratingCount != null ? app.ratingCount.toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {app.pricingHint || "-"}
                    </TableCell>
                    {platformApps.some((a) => a.activeInstalls != null) && (
                      <TableCell className="text-right">
                        {app.activeInstalls != null
                          ? app.activeInstalls.toLocaleString()
                          : "-"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
