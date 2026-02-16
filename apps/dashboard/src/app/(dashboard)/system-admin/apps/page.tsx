"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
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

export default function AppsListPage() {
  const { fetchWithAuth } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);

  useEffect(() => {
    loadApps();
  }, [showAll]);

  async function loadApps() {
    const url = showAll
      ? "/api/system-admin/apps"
      : "/api/system-admin/apps?tracked=true";
    const res = await fetchWithAuth(url);
    if (res.ok) setApps(await res.json());
  }

  async function toggleAccounts(slug: string) {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
      setAccountsList([]);
      return;
    }
    setExpandedSlug(slug);
    const res = await fetchWithAuth(`/api/system-admin/apps/${slug}/accounts`);
    if (res.ok) setAccountsList(await res.json());
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Apps"}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Apps ({apps.length})</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAll(false)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                !showAll
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              Tracked Only
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                showAll
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              All Apps
            </button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracked By</TableHead>
                <TableHead>Competitor For</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app: any) => (
                <>
                  <TableRow key={app.slug}>
                    <TableCell>
                      <Link
                        href={`/apps/${app.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {app.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {app.slug}
                    </TableCell>
                    <TableCell>
                      {app.isTracked ? (
                        <Badge variant="default">Tracked</Badge>
                      ) : (
                        <Badge variant="secondary">Not tracked</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {(app.trackedByCount > 0 || app.competitorByCount > 0) ? (
                        <button
                          onClick={() => toggleAccounts(app.slug)}
                          className="text-primary hover:underline text-sm"
                        >
                          {app.trackedByCount} account{app.trackedByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {app.competitorByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(app.slug)}
                          className="text-primary hover:underline text-sm"
                        >
                          {app.competitorByCount} account{app.competitorByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.lastScrapedAt
                        ? new Date(app.lastScrapedAt).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                  {expandedSlug === app.slug && (
                    <TableRow key={`${app.slug}-accounts`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <div className="text-sm font-medium mb-2">
                          Accounts using &quot;{app.name}&quot;
                        </div>
                        {accountsList.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No accounts
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {accountsList.map((a: any) => (
                              <Link
                                key={`${a.accountId}-${a.type}`}
                                href={`/system-admin/accounts/${a.accountId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-sm hover:bg-muted transition-colors"
                              >
                                {a.accountName}
                                <Badge
                                  variant={
                                    a.type === "tracked"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {a.type}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {apps.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No apps found
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
