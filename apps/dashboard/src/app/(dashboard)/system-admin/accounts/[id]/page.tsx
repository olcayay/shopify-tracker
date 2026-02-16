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

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchWithAuth } = useAuth();
  const [account, setAccount] = useState<any>(null);
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
    loadAccount();
  }, [id]);

  async function loadAccount() {
    setLoading(true);
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`);
    if (res.ok) {
      const data = await res.json();
      setAccount(data);
      setLimits({
        maxTrackedApps: data.maxTrackedApps,
        maxTrackedKeywords: data.maxTrackedKeywords,
        maxCompetitorApps: data.maxCompetitorApps,
        maxTrackedFeatures: data.maxTrackedFeatures,
        maxUsers: data.maxUsers,
      });
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
      loadAccount();
    } else {
      setMessage("Failed to update limits");
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
      loadAccount();
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Accounts > "}
          {account.name}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <Badge variant={account.isSuspended ? "destructive" : "default"}>
            {account.isSuspended ? "Suspended" : "Active"}
          </Badge>
        </div>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {/* Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Limits & Usage</CardTitle>
              <CardDescription>Account resource limits</CardDescription>
            </div>
            <div className="flex gap-2">
              {editLimits ? (
                <>
                  <Button size="sm" onClick={saveLimits}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditLimits(false)}
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
            <div>
              <p className="text-sm text-muted-foreground">Tracked Apps</p>
              <p className="text-2xl font-bold">
                {account.trackedApps?.length ?? 0}
                <span className="text-lg text-muted-foreground font-normal">
                  /
                  {editLimits ? (
                    <Input
                      type="number"
                      className="w-20 inline-block h-7 text-sm ml-1"
                      value={limits.maxTrackedApps}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          maxTrackedApps: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    account.maxTrackedApps
                  )}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Keywords</p>
              <p className="text-2xl font-bold">
                {account.trackedKeywords?.length ?? 0}
                <span className="text-lg text-muted-foreground font-normal">
                  /
                  {editLimits ? (
                    <Input
                      type="number"
                      className="w-20 inline-block h-7 text-sm ml-1"
                      value={limits.maxTrackedKeywords}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          maxTrackedKeywords: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    account.maxTrackedKeywords
                  )}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Competitors</p>
              <p className="text-2xl font-bold">
                {account.competitorApps?.length ?? 0}
                <span className="text-lg text-muted-foreground font-normal">
                  /
                  {editLimits ? (
                    <Input
                      type="number"
                      className="w-20 inline-block h-7 text-sm ml-1"
                      value={limits.maxCompetitorApps}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          maxCompetitorApps: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    account.maxCompetitorApps
                  )}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Features</p>
              <p className="text-2xl font-bold">
                {account.trackedFeatures?.length ?? 0}
                <span className="text-lg text-muted-foreground font-normal">
                  /
                  {editLimits ? (
                    <Input
                      type="number"
                      className="w-20 inline-block h-7 text-sm ml-1"
                      value={limits.maxTrackedFeatures}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          maxTrackedFeatures: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    account.maxTrackedFeatures
                  )}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Users</p>
              <p className="text-2xl font-bold">
                {account.members?.length ?? 0}
                <span className="text-lg text-muted-foreground font-normal">
                  /
                  {editLimits ? (
                    <Input
                      type="number"
                      className="w-20 inline-block h-7 text-sm ml-1"
                      value={limits.maxUsers}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          maxUsers: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    account.maxUsers
                  )}
                </span>
              </p>
            </div>
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
                    {new Date(m.createdAt).toLocaleDateString()}
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
                      ? new Date(a.lastScrapedAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
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
                      ? new Date(k.lastScrapedAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
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
                      ? new Date(c.lastScrapedAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
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
