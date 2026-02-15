"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play } from "lucide-react";

const SCRAPER_TYPES = [
  { type: "category", label: "Categories" },
  { type: "app_details", label: "App Details" },
  { type: "keyword_search", label: "Keywords" },
  { type: "reviews", label: "Reviews" },
];

export default function SystemAdminPage() {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [statsRes, accountsRes, usersRes, runsRes] = await Promise.all([
      fetchWithAuth("/api/system-admin/stats"),
      fetchWithAuth("/api/system-admin/accounts"),
      fetchWithAuth("/api/system-admin/users"),
      fetchWithAuth("/api/system-admin/scraper/runs?limit=20"),
    ]);

    if (statsRes.ok) setStats(await statsRes.json());
    if (accountsRes.ok) setAccounts(await accountsRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    if (runsRes.ok) setRuns(await runsRes.json());
  }

  async function triggerScraper(type: string) {
    setTriggering(type);
    setMessage("");
    const res = await fetchWithAuth("/api/system-admin/scraper/trigger", {
      method: "POST",
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      setMessage(`Scraper "${type}" triggered`);
      setTimeout(loadData, 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to trigger scraper");
    }
    setTriggering(null);
  }

  async function updateAccount(id: string, updates: any) {
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setMessage("Account updated");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Admin</h1>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {/* Global Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Accounts</CardDescription>
              <CardTitle className="text-2xl">{stats.accounts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Users</CardDescription>
              <CardTitle className="text-2xl">{stats.users}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Apps</CardDescription>
              <CardTitle className="text-2xl">{stats.totalApps}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tracked Apps</CardDescription>
              <CardTitle className="text-2xl">{stats.trackedApps}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Keywords</CardDescription>
              <CardTitle className="text-2xl">
                {stats.trackedKeywords}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="scraper">Scraper</TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Apps</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Competitors</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc: any) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell>{acc.usage?.members ?? "-"}</TableCell>
                      <TableCell>
                        {acc.usage?.trackedApps ?? 0}/{acc.maxTrackedApps}
                      </TableCell>
                      <TableCell>
                        {acc.usage?.trackedKeywords ?? 0}/
                        {acc.maxTrackedKeywords}
                      </TableCell>
                      <TableCell>
                        {acc.usage?.competitorApps ?? 0}/
                        {acc.maxCompetitorApps}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={acc.isSuspended ? "destructive" : "default"}
                        >
                          {acc.isSuspended ? "Suspended" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateAccount(acc.id, {
                              isSuspended: !acc.isSuspended,
                            })
                          }
                        >
                          {acc.isSuspended ? "Activate" : "Suspend"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="text-sm">
                        {u.accountName || u.accountId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.isSystemAdmin && (
                          <Badge variant="default">Admin</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scraper Tab */}
        <TabsContent value="scraper" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trigger Scraper</CardTitle>
              <CardDescription>
                Manually trigger scraper jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {SCRAPER_TYPES.map((s) => (
                  <Button
                    key={s.type}
                    variant="outline"
                    onClick={() => triggerScraper(s.type)}
                    disabled={triggering !== null}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {triggering === s.type ? "Triggering..." : s.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Triggered By</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run: any) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-sm">
                        {run.scraperType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "default"
                              : run.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.triggeredBy}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {run.startedAt
                          ? new Date(run.startedAt).toLocaleString()
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.metadata?.duration_ms
                          ? `${Math.round(run.metadata.duration_ms / 1000)}s`
                          : "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        No scraper runs yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
