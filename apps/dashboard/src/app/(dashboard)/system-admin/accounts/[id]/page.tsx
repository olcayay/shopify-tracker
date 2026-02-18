"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormatDate } from "@/lib/format-date";

interface Package {
  id: number;
  slug: string;
  name: string;
  maxTrackedApps: number;
  maxTrackedKeywords: number;
  maxCompetitorApps: number;
  maxTrackedFeatures: number;
  maxUsers: number;
  sortOrder: number;
}

const LIMIT_KEYS = [
  { key: "maxTrackedApps", label: "Tracked Apps", usageKey: "trackedApps" },
  { key: "maxTrackedKeywords", label: "Keywords", usageKey: "trackedKeywords" },
  { key: "maxCompetitorApps", label: "Competitors", usageKey: "competitorApps" },
  { key: "maxTrackedFeatures", label: "Features", usageKey: "trackedFeatures" },
  { key: "maxUsers", label: "Users", usageKey: "members" },
] as const;

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchWithAuth } = useAuth();
  const { formatDateTime, formatDateOnly } = useFormatDate();
  const [account, setAccount] = useState<any>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editLimits, setEditLimits] = useState(false);
  const [limits, setLimits] = useState({
    maxTrackedApps: 0,
    maxTrackedKeywords: 0,
    maxCompetitorApps: 0,
    maxTrackedFeatures: 0,
    maxUsers: 0,
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    const [accRes, pkgRes] = await Promise.all([
      fetchWithAuth(`/api/system-admin/accounts/${id}`),
      fetchWithAuth("/api/system-admin/packages"),
    ]);
    if (accRes.ok) {
      const data = await accRes.json();
      setAccount(data);
      setLimits({
        maxTrackedApps: data.maxTrackedApps,
        maxTrackedKeywords: data.maxTrackedKeywords,
        maxCompetitorApps: data.maxCompetitorApps,
        maxTrackedFeatures: data.maxTrackedFeatures,
        maxUsers: data.maxUsers,
      });
    }
    if (pkgRes.ok) {
      setAllPackages(await pkgRes.json());
    }
    setLoading(false);
  }

  async function saveLimits() {
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(limits),
    });
    if (res.ok) {
      setMessage("Limits updated");
      setEditLimits(false);
      loadData();
    } else {
      setMessage("Failed to update limits");
    }
  }

  async function changePackage(packageId: number) {
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ packageId, applyPackageDefaults: true }),
    });
    if (res.ok) {
      setMessage("Package changed — limits reset to package defaults");
      loadData();
    } else {
      setMessage("Failed to change package");
    }
  }

  async function resetToPackageDefaults() {
    if (!account?.packageId) return;
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ packageId: account.packageId, applyPackageDefaults: true }),
    });
    if (res.ok) {
      setMessage("Limits reset to package defaults");
      setEditLimits(false);
      loadData();
    }
  }

  async function toggleSuspend() {
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isSuspended: !account.isSuspended }),
    });
    if (res.ok) {
      setMessage(account.isSuspended ? "Account activated" : "Account suspended");
      loadData();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Account Detail</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!account) {
    return <p className="text-muted-foreground">Account not found.</p>;
  }

  const pkg: Package | undefined = account.package ?? undefined;
  const hasOverrides = pkg
    ? LIMIT_KEYS.some(
        ({ key }) => account[key] !== (pkg as any)[key]
      )
    : false;

  const usageCounts: Record<string, number> = {
    trackedApps: account.trackedApps?.length ?? 0,
    trackedKeywords: account.trackedKeywords?.length ?? 0,
    competitorApps: account.competitorApps?.length ?? 0,
    trackedFeatures: account.trackedFeatures?.length ?? 0,
    members: account.members?.length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > "}
          <Link href="/system-admin/accounts" className="hover:underline">
            Accounts
          </Link>
          {" > "}
          {account.name}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <Badge variant={account.isSuspended ? "destructive" : "default"}>
            {account.isSuspended ? "Suspended" : "Active"}
          </Badge>
          {pkg && (
            <Badge variant="outline">
              {pkg.name}
              {hasOverrides && <span className="ml-0.5 text-amber-500">*</span>}
            </Badge>
          )}
        </div>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {/* Package Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Package</CardTitle>
          <CardDescription>
            {pkg
              ? `Current: ${pkg.name}${hasOverrides ? " (with custom overrides)" : ""}`
              : "No package assigned"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allPackages.map((p) => (
              <Button
                key={p.id}
                variant={account.packageId === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (account.packageId !== p.id) changePackage(p.id);
                }}
              >
                {p.name}
                <span className="ml-1.5 text-xs opacity-70">
                  ({p.maxTrackedApps}/{p.maxTrackedKeywords}/{p.maxCompetitorApps})
                </span>
              </Button>
            ))}
          </div>
          {pkg && (
            <p className="text-xs text-muted-foreground mt-3">
              Package defaults: Apps {pkg.maxTrackedApps} · Keywords {pkg.maxTrackedKeywords} · Competitors {pkg.maxCompetitorApps} · Features {pkg.maxTrackedFeatures} · Users {pkg.maxUsers}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Limits & Usage</CardTitle>
              <CardDescription>
                {hasOverrides
                  ? "Custom limits (differs from package defaults)"
                  : "Account resource limits"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {editLimits ? (
                <>
                  <Button size="sm" onClick={saveLimits}>
                    Save
                  </Button>
                  {hasOverrides && pkg && (
                    <Button size="sm" variant="outline" onClick={resetToPackageDefaults}>
                      Reset to Defaults
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditLimits(false);
                      setLimits({
                        maxTrackedApps: account.maxTrackedApps,
                        maxTrackedKeywords: account.maxTrackedKeywords,
                        maxCompetitorApps: account.maxCompetitorApps,
                        maxTrackedFeatures: account.maxTrackedFeatures,
                        maxUsers: account.maxUsers,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditLimits(true)}
                  >
                    Edit Limits
                  </Button>
                  <Button
                    size="sm"
                    variant={account.isSuspended ? "default" : "destructive"}
                    onClick={toggleSuspend}
                  >
                    {account.isSuspended ? "Activate" : "Suspend"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {LIMIT_KEYS.map(({ key, label, usageKey }) => {
              const isOverridden = pkg && account[key] !== (pkg as any)[key];
              return (
                <div key={key}>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {label}
                    {isOverridden && (
                      <span className="text-amber-500 text-xs" title={`Package default: ${(pkg as any)[key]}`}>*</span>
                    )}
                  </p>
                  <p className="text-2xl font-bold">
                    {usageCounts[usageKey]}
                    <span className="text-lg text-muted-foreground font-normal">
                      /
                      {editLimits ? (
                        <Input
                          type="number"
                          className="w-20 inline-block h-7 text-sm ml-1"
                          value={(limits as any)[key]}
                          onChange={(e) =>
                            setLimits((l) => ({
                              ...l,
                              [key]: Number(e.target.value),
                            }))
                          }
                        />
                      ) : (
                        account[key]
                      )}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({account.members?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(account.members || []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      href={`/system-admin/users/${m.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {m.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {m.isSystemAdmin && <Badge>Admin</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateOnly(m.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tracked Apps */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked Apps ({account.trackedApps?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(account.trackedApps || []).map((a: any) => (
                <TableRow key={a.appSlug}>
                  <TableCell>
                    <Link
                      href={`/apps/${a.appSlug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {a.appName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {a.appSlug}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.lastScrapedAt
                      ? formatDateTime(a.lastScrapedAt)
                      : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
              {(account.trackedApps?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No tracked apps
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tracked Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>
            Tracked Keywords ({account.trackedKeywords?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(account.trackedKeywords || []).map((k: any) => (
                <TableRow key={k.keywordId}>
                  <TableCell>
                    <Link
                      href={`/keywords/${k.keyword}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {k.keyword}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {k.lastScrapedAt
                      ? formatDateTime(k.lastScrapedAt)
                      : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
              {(account.trackedKeywords?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No tracked keywords
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Competitor Apps */}
      <Card>
        <CardHeader>
          <CardTitle>
            Competitor Apps ({account.competitorApps?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(account.competitorApps || []).map((c: any) => (
                <TableRow key={c.appSlug}>
                  <TableCell>
                    <Link
                      href={`/apps/${c.appSlug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {c.appName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {c.appSlug}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.lastScrapedAt
                      ? formatDateTime(c.lastScrapedAt)
                      : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
              {(account.competitorApps?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No competitor apps
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tracked Features */}
      <Card>
        <CardHeader>
          <CardTitle>
            Tracked Features ({account.trackedFeatures?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Handle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(account.trackedFeatures || []).map((f: any) => (
                <TableRow key={f.featureHandle}>
                  <TableCell>
                    <Link
                      href={`/features/${encodeURIComponent(f.featureHandle)}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {f.featureTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {f.featureHandle}
                  </TableCell>
                </TableRow>
              ))}
              {(account.trackedFeatures?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No tracked features
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
