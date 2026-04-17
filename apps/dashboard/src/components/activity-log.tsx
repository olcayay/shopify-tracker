"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { getPlatformColor, PLATFORM_DISPLAY } from "@/lib/platform-display";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityLogEntry {
  id: number;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface ActivityLogResponse {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Action label mapping
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  app_tracked: "Tracked app",
  app_untracked: "Untracked app",
  keyword_tracked: "Tracked keyword",
  keyword_untracked: "Untracked keyword",
  competitor_added: "Added competitor",
  competitor_removed: "Removed competitor",
  member_invited: "Invited member",
  member_removed: "Removed member",
  invitation_accepted: "Joined account",
  invitation_cancelled: "Cancelled invitation",
  invitation_resent: "Resent invitation",
  platform_enabled: "Enabled platform",
  platform_disabled: "Disabled platform",
  account_updated: "Updated account",
  account_deleted: "Deleted account",
  password_reset: "Reset password",
  password_changed: "Changed password",
  profile_updated: "Updated profile",
  member_role_changed: "Changed member role",
  subscription_activated: "Activated subscription",
};

export { ACTION_LABELS };

const FILTER_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "app_tracked", label: "Tracked app" },
  { value: "app_untracked", label: "Untracked app" },
  { value: "keyword_tracked", label: "Tracked keyword" },
  { value: "keyword_untracked", label: "Untracked keyword" },
  { value: "competitor_added", label: "Added competitor" },
  { value: "competitor_removed", label: "Removed competitor" },
  { value: "member_invited", label: "Invited member" },
  { value: "member_removed", label: "Removed member" },
  { value: "invitation_accepted", label: "Joined account" },
  { value: "platform_enabled", label: "Enabled platform" },
  { value: "platform_disabled", label: "Disabled platform" },
  { value: "member_role_changed", label: "Changed member role" },
  { value: "account_updated", label: "Updated account" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatFullDate(date: string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a slug into a display name: "my-cool-app" → "my-cool-app" (keep as-is for slugs) */
function formatSlug(slug: string): string {
  return slug;
}

/** Truncate a name with an ellipsis when longer than `max` characters. */
const APP_NAME_MAX_CHARS = 36;
export function truncateAppName(value: string, max: number = APP_NAME_MAX_CHARS): string {
  if (!value) return value;
  return value.length > max ? value.slice(0, max) + "…" : value;
}

/** Get platform display name */
function platformName(key: string): string {
  return PLATFORM_DISPLAY[key as keyof typeof PLATFORM_DISPLAY]?.label ?? key;
}

/** Build an app link. `name` is shown (truncated) when present; otherwise the (truncated) slug is. */
function AppLink({ platform, slug, name }: { platform?: string; slug: string; name?: string }) {
  const href = platform ? `/${platform}/apps/${slug}` : "#";
  const full = name || formatSlug(slug);
  const display = truncateAppName(full);
  return (
    <Link
      href={href}
      title={full}
      className="font-medium text-foreground hover:underline"
    >
      {display}
    </Link>
  );
}

function getDetails(entry: ActivityLogEntry): React.ReactNode {
  const m = entry.metadata;
  if (!m) return entry.entityId || "";

  switch (entry.action) {
    case "app_tracked":
    case "app_untracked": {
      const slug = (m.slug as string) || entry.entityId || "";
      const name = m.appName as string | undefined;
      const platform = m.platform as string | undefined;
      if (!slug) return "";
      return <AppLink platform={platform} slug={slug} name={name} />;
    }
    case "keyword_tracked": {
      const keyword = (m.keyword as string) || "";
      const appSlug = m.appSlug as string | undefined;
      const appName = m.appName as string | undefined;
      const platform = m.platform as string | undefined;
      if (!keyword && !appSlug) return entry.entityId || "";
      return (
        <span>
          &ldquo;{keyword}&rdquo;
          {appSlug && (
            <> for <AppLink platform={platform} slug={appSlug} name={appName} /></>
          )}
        </span>
      );
    }
    case "keyword_untracked": {
      const keyword = (m.keyword as string) || (m.keywordText as string) || "";
      if (keyword) return <span>&ldquo;{keyword}&rdquo;</span>;
      return entry.entityId ? `keyword #${entry.entityId}` : "";
    }
    case "competitor_added":
    case "competitor_removed": {
      const competitorSlug = (m.competitorSlug as string) || "";
      const competitorName = m.competitorName as string | undefined;
      const trackedAppSlug = m.trackedAppSlug as string | undefined;
      const trackedAppName = m.trackedAppName as string | undefined;
      const platform = m.platform as string | undefined;
      if (!competitorSlug) return entry.entityId || "";
      return (
        <span>
          <AppLink platform={platform} slug={competitorSlug} name={competitorName} />
          {trackedAppSlug && (
            <> for <AppLink platform={platform} slug={trackedAppSlug} name={trackedAppName} /></>
          )}
        </span>
      );
    }
    case "member_invited":
      return (
        <span>
          <span className="font-medium text-foreground">{(m.email as string) || ""}</span>
          {m.role ? <> as <span className="capitalize">{m.role as string}</span></> : null}
        </span>
      );
    case "member_removed":
    case "invitation_cancelled":
    case "invitation_resent":
      return <span className="font-medium text-foreground">{(m.email as string) || entry.entityId || ""}</span>;
    case "invitation_accepted":
      return (
        <span>
          <span className="font-medium text-foreground">{(m.email as string) || ""}</span>
          {" "}joined as <span className="capitalize">{(m.role as string) || "member"}</span>
        </span>
      );
    case "member_role_changed":
      return (
        <span>
          <span className="font-medium text-foreground">{(m.email as string) || ""}</span>
          {m.oldRole && m.newRole ? (
            <> <span className="capitalize">{m.oldRole as string}</span> → <span className="capitalize">{m.newRole as string}</span></>
          ) : null}
        </span>
      );
    case "platform_enabled":
    case "platform_disabled": {
      const p = (m.platform as string) || entry.entityId || "";
      return <span className="font-medium text-foreground">{platformName(p)}</span>;
    }
    case "account_updated": {
      const fields = m.fields as string[] | undefined;
      return fields ? fields.join(", ") : "";
    }
    default:
      return entry.entityId || "";
  }
}

function getPlatformFromEntry(entry: ActivityLogEntry): string | null {
  const m = entry.metadata;
  if (!m) return null;
  return (m.platform as string) || null;
}

// ---------------------------------------------------------------------------
// User initials avatar
// ---------------------------------------------------------------------------

function UserAvatar({ name, email }: { name?: string; email?: string }) {
  const display = name || email || "?";
  const initials = display
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground shrink-0">
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Platform mini-badge
// ---------------------------------------------------------------------------

function PlatformDot({ platform }: { platform: string }) {
  const color = getPlatformColor(platform);
  const label =
    PLATFORM_DISPLAY[platform as keyof typeof PLATFORM_DISPLAY]?.label ??
    platform;

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
      title={label}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// ActivityLog component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

export function ActivityLog() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<ActivityLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetchWithAuth(
        `/api/account/activity-log?${params.toString()}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              Track all actions performed by team members
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="border rounded-md px-2 py-1 text-xs bg-background"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Empty state */}
        {!loading && data && data.logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity yet
          </p>
        )}

        {/* Table */}
        {(loading || (data && data.logs.length > 0)) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">User</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="hidden sm:table-cell w-[100px]">
                    Platform
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} />
                    ))
                  : data?.logs.map((entry) => {
                      const platform = getPlatformFromEntry(entry);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {entry.user ? (
                                <>
                                  <UserAvatar
                                    name={entry.user.name}
                                    email={entry.user.email}
                                  />
                                  <span className="text-xs truncate max-w-[100px]">
                                    {entry.user.name || entry.user.email}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <UserAvatar name="System" />
                                  <span className="text-xs text-muted-foreground">
                                    System
                                  </span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[11px]">
                              {ACTION_LABELS[entry.action] || entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground max-w-[420px] block break-words">
                              {getDetails(entry)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {platform && <PlatformDot platform={platform} />}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className="text-xs text-muted-foreground"
                              title={formatFullDate(entry.createdAt)}
                            >
                              {timeAgo(entry.createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-muted-foreground">
              {data.total} total entries
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
