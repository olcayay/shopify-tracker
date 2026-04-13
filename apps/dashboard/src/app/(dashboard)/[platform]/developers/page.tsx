"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Bookmark,
  Users,
  Swords,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TableSkeleton } from "@/components/skeletons";
import { developerNameToSlug } from "@appranks/shared";
import { formatNumber, formatMonthYear } from "@/lib/format-utils";

interface TopApp {
  iconUrl: string;
  name: string;
  slug: string;
  platform: string;
}

interface Developer {
  id: number;
  slug: string;
  name: string;
  website: string | null;
  platformCount: number;
  linkCount: number;
  appCount: number;
  platforms: string[];
  topApps: TopApp[];
  avgReviewCount: number | null;
  avgRating: number | null;
  firstAppLaunchDate: string | null;
  lastAppLaunchDate: string | null;
  isStarred: boolean;
}

interface TrackedDeveloper {
  id: number;
  slug: string;
  name: string;
  platformCount: number;
  platforms: string[];
  totalApps: number;
  isStarred: boolean;
  trackedApps: { slug: string; name: string; platform: string; iconUrl: string | null }[];
}

interface CompetitorDeveloper {
  id: number;
  slug: string;
  name: string;
  platformCount: number;
  platforms: string[];
  totalApps: number;
  isStarred: boolean;
  competitorApps: { slug: string; name: string; platform: string; iconUrl: string | null }[];
}

interface DeveloperResponse {
  developers: Developer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function DeveloperSectionEmpty({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      <Link href={ctaHref}>
        <Button variant="outline" size="sm">{ctaLabel}</Button>
      </Link>
    </div>
  );
}

export default function PlatformDevelopersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={4} />}>
      <PlatformDevelopersContent />
    </Suspense>
  );
}

function PlatformDevelopersContent() {
  const { platform } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const developerName = searchParams.get("name") || "";
  const { fetchWithAuth } = useAuth();

  // Redirect legacy ?name=X to slug-based URL
  useEffect(() => {
    if (developerName) {
      const slug = developerNameToSlug(developerName);
      router.replace(`/${platform}/developers/${slug}`);
    }
  }, [developerName, platform, router]);

  const [data, setData] = useState<DeveloperResponse | null>(null);
  const [trackedDevs, setTrackedDevs] = useState<TrackedDeveloper[]>([]);
  const [competitorDevs, setCompetitorDevs] = useState<CompetitorDeveloper[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("apps");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [topOrder, setTopOrder] = useState<"asc" | "desc">("desc");
  const [competitorOrder, setCompetitorOrder] = useState<"asc" | "desc">("desc");
  const limit = 25;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
        order,
        platforms: String(platform),
      });
      if (search) params.set("search", search);
      const res = await fetchWithAuth(`/api/developers?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, search, sort, order, platform]);

  useEffect(() => {
    if (!developerName) loadData();
  }, [loadData, developerName]);

  // Fetch tracked + competitor developers for this platform
  useEffect(() => {
    if (developerName) return;
    (async () => {
      try {
        const [trackedRes, competitorRes] = await Promise.all([
          fetchWithAuth("/api/developers/tracked"),
          fetchWithAuth(`/api/developers/competitors?platform=${platform}`),
        ]);
        if (trackedRes.ok) {
          const body = await trackedRes.json();
          // Filter to only devs with apps on this platform
          const filtered = (body.developers ?? []).filter((d: TrackedDeveloper) =>
            d.platforms.includes(String(platform))
          );
          setTrackedDevs(filtered);
        }
        if (competitorRes.ok) {
          const body = await competitorRes.json();
          setCompetitorDevs(body.developers ?? []);
        }
      } catch { /* ignore */ }
    })();
  }, [fetchWithAuth, platform, developerName]);

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadData();
  }

  const sortedTrackedDevs = useMemo(() => {
    const signed = topOrder === "desc" ? -1 : 1;
    return [...trackedDevs].sort((a, b) => {
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      const cmp = (a.totalApps || 0) - (b.totalApps || 0);
      if (cmp !== 0) return signed * cmp;
      return a.name.localeCompare(b.name);
    });
  }, [trackedDevs, topOrder]);

  const sortedCompetitorDevs = useMemo(() => {
    const signed = competitorOrder === "desc" ? -1 : 1;
    return [...competitorDevs].sort((a, b) => {
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      const cmp = (a.totalApps || 0) - (b.totalApps || 0);
      if (cmp !== 0) return signed * cmp;
      return a.name.localeCompare(b.name);
    });
  }, [competitorDevs, competitorOrder]);

  function sortDevelopers(devs: Developer[]): Developer[] {
    return [...devs].sort((a, b) => {
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      let cmp = 0;
      if (sort === "apps") {
        cmp = a.appCount - b.appCount;
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return order === "desc" ? -cmp : cmp;
    });
  }

  async function toggleStar(devId: number, currentlyStarred: boolean) {
    if (!data) return;
    const updated = data.developers.map((d) =>
      d.id === devId ? { ...d, isStarred: !currentlyStarred } : d
    );
    setData({ ...data, developers: sortDevelopers(updated) });
    try {
      const method = currentlyStarred ? "DELETE" : "POST";
      const res = await fetchWithAuth(
        `/api/account/starred-developers/${devId}`,
        { method }
      );
      if (!res.ok) throw new Error();
    } catch {
      setData((prev) => {
        if (!prev) return prev;
        const reverted = prev.developers.map((d) =>
          d.id === devId ? { ...d, isStarred: currentlyStarred } : d
        );
        return { ...prev, developers: sortDevelopers(reverted) };
      });
    }
  }

  // If redirecting ?name=X, show nothing
  if (developerName) return null;

  const developers = data?.developers ?? [];
  const pagination = data?.pagination;
  const emptyMessage = search
    ? "No developers found matching your search."
    : "No developers found.";

  const maxIcons = 10;

  function renderAppsCell(dev: Developer) {
    const visibleApps = dev.topApps.slice(0, maxIcons);
    const remaining = dev.appCount - visibleApps.length;

    if (visibleApps.length === 0) {
      return <span className="text-muted-foreground text-sm">0</span>;
    }

    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center -space-x-1.5">
          {visibleApps.map((app, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Link
                  href={`/${app.platform}/apps/${app.slug}`}
                  className="shrink-0 rounded border border-background hover:z-10 hover:scale-110 transition-transform"
                >
                  <img
                    src={app.iconUrl}
                    alt={app.name}
                    className="w-5 h-5 rounded"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {app.name}
              </TooltipContent>
            </Tooltip>
          ))}
          {remaining > 0 && (
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border border-background shrink-0">
              +{remaining}
            </span>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developers</h1>
        <p className="text-sm text-muted-foreground">
          Browse all developers on this platform
        </p>
      </div>

      {/* My Developers section */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">My Developers</h2>
          <span className="text-xs text-muted-foreground">Developers of your tracked apps</span>
        </div>
        {trackedDevs.length === 0 ? (
          <DeveloperSectionEmpty
            icon={Users}
            title={`No tracked developers on this platform`}
            description="Track apps on this platform to see their developers here."
            ctaLabel="Browse Apps"
            ctaHref={`/${platform}/apps`}
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Developer</TableHead>
                <TableHead className="w-96">My Tracked Apps</TableHead>
                <TableHead className="w-36 text-right">
                  <button
                    onClick={() => setTopOrder(topOrder === "desc" ? "asc" : "desc")}
                    className="flex items-center gap-1 justify-end hover:text-foreground ml-auto"
                  >
                    App Count <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTrackedDevs.map((dev) => (
                <TableRow key={dev.id}>
                  <TableCell className="w-10"></TableCell>
                  <TableCell>
                    <Link href={`/${platform}/developers/${dev.slug}`} className="font-medium hover:underline">
                      {dev.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {dev.trackedApps.filter((a) => a.platform === platform).map((app) => (
                        <Link
                          key={`${app.platform}-${app.slug}`}
                          href={`/${app.platform}/apps/${app.slug}`}
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                          title={app.name}
                        >
                          {app.iconUrl && (
                            <img src={app.iconUrl} alt="" aria-hidden="true" className="w-4 h-4 rounded shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">{app.name}</span>
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {dev.totalApps || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Competitor Developers section */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Swords className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Competitor Developers</h2>
          <span className="text-xs text-muted-foreground">Developers behind your competitors&apos; apps</span>
        </div>
        {competitorDevs.length === 0 ? (
          <DeveloperSectionEmpty
            icon={Swords}
            title={`No competitor developers on this platform`}
            description="Add competitors to your apps and their developers will appear here."
            ctaLabel="View Competitors"
            ctaHref={`/${platform}/competitors`}
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Developer</TableHead>
                <TableHead className="w-96">Competitor Apps</TableHead>
                <TableHead className="w-36 text-right">
                  <button
                    onClick={() => setCompetitorOrder(competitorOrder === "desc" ? "asc" : "desc")}
                    className="flex items-center gap-1 justify-end hover:text-foreground ml-auto"
                  >
                    App Count <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompetitorDevs.map((dev) => (
                <TableRow key={dev.id}>
                  <TableCell className="w-10"></TableCell>
                  <TableCell>
                    <Link href={`/${platform}/developers/${dev.slug}`} className="font-medium hover:underline">
                      {dev.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {dev.competitorApps.map((app) => (
                        <Link
                          key={`${app.platform}-${app.slug}`}
                          href={`/${app.platform}/apps/${app.slug}`}
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                          title={app.name}
                        >
                          {app.iconUrl && (
                            <img src={app.iconUrl} alt="" aria-hidden="true" className="w-4 h-4 rounded shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">{app.name}</span>
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {dev.totalApps || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search developers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      {loading && !data ? (
        <TableSkeleton rows={10} cols={4} />
      ) : (
        <>
          <div className="rounded-md border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Developer <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-96">Apps</TableHead>
                  <TableHead className="w-24 text-right">
                    <button
                      onClick={() => toggleSort("apps")}
                      className="flex items-center gap-1 justify-end hover:text-foreground w-full"
                    >
                      App Count <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    <button
                      onClick={() => toggleSort("avgReviews")}
                      title="Average review count across this developer's apps"
                      className="flex items-center gap-1 justify-end hover:text-foreground w-full"
                    >
                      Avg Reviews <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    <button
                      onClick={() => toggleSort("avgRating")}
                      title="Average rating across this developer's apps (excludes apps with no reviews)"
                      className="flex items-center gap-1 justify-end hover:text-foreground w-full"
                    >
                      Avg Rating <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-28 text-right">
                    <button
                      onClick={() => toggleSort("firstLaunch")}
                      title="First app launch (earliest launched_date across this developer's apps)"
                      className="flex items-center gap-1 justify-end hover:text-foreground w-full"
                    >
                      First Launch <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-28 text-right">
                    <button
                      onClick={() => toggleSort("lastLaunch")}
                      title="Most recent app launch"
                      className="flex items-center gap-1 justify-end hover:text-foreground w-full"
                    >
                      Last Launch <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {developers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  developers.map((dev) => (
                    <TableRow key={dev.id}>
                      <TableCell className="w-10">
                        <button
                          onClick={() => toggleStar(dev.id, dev.isStarred)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          aria-label={
                            dev.isStarred
                              ? "Remove bookmark"
                              : "Bookmark developer"
                          }
                        >
                          <Bookmark
                            className={`h-4 w-4 ${
                              dev.isStarred
                                ? "fill-amber-500 text-amber-500"
                                : "text-muted-foreground hover:text-amber-500"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/${platform}/developers/${dev.slug}`}
                          className="font-medium hover:underline"
                        >
                          {dev.name}
                        </Link>
                      </TableCell>
                      <TableCell>{renderAppsCell(dev)}</TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {dev.appCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {dev.avgReviewCount != null
                          ? formatNumber(Math.round(dev.avgReviewCount), { compact: true })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {dev.avgRating != null
                          ? `${dev.avgRating.toFixed(1)} ★`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {dev.firstAppLaunchDate
                          ? formatMonthYear(dev.firstAppLaunchDate)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {dev.lastAppLaunchDate
                          ? formatMonthYear(dev.lastAppLaunchDate)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.total} developers)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
