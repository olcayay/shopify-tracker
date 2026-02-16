"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fetchWithAuth } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [id]);

  async function loadUser() {
    setLoading(true);
    const res = await fetchWithAuth(`/api/system-admin/users/${id}`);
    if (res.ok) {
      setUser(await res.json());
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">User Detail</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <p className="text-muted-foreground">User not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Users > "}
          {user.name}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <Badge variant="outline">{user.role}</Badge>
          {user.isSystemAdmin && <Badge>System Admin</Badge>}
        </div>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Account:</span>{" "}
              <Link
                href={`/system-admin/accounts/${user.accountId}`}
                className="text-primary hover:underline font-medium"
              >
                {user.accountName}
              </Link>
            </div>
            <div>
              <span className="text-muted-foreground">Role:</span>{" "}
              <Badge variant="outline">{user.role}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Joined:</span>{" "}
              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tracked Apps</CardDescription>
            <CardTitle className="text-2xl">
              {user.trackedApps?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Keywords</CardDescription>
            <CardTitle className="text-2xl">
              {user.trackedKeywords?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Competitors</CardDescription>
            <CardTitle className="text-2xl">
              {user.competitorApps?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Features</CardDescription>
            <CardTitle className="text-2xl">
              {user.trackedFeatures?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tracked Apps */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked Apps</CardTitle>
          <CardDescription>Apps tracked by this user&apos;s account</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(user.trackedApps || []).map((a: any) => (
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
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "\u2014"}
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
              {(user.trackedApps?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
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
          <CardTitle>Tracked Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(user.trackedKeywords || []).map((k: any) => (
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
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "\u2014"}
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
              {(user.trackedKeywords?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
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
          <CardTitle>Competitor Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(user.competitorApps || []).map((c: any) => (
                <TableRow key={c.appSlug}>
                  <TableCell>
                    <Link
                      href={`/apps/${c.appSlug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {c.appName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "\u2014"}
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
              {(user.competitorApps?.length ?? 0) === 0 && (
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
          <CardTitle>Tracked Features</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(user.trackedFeatures || []).map((f: any) => (
                <TableRow key={f.featureHandle}>
                  <TableCell>
                    <Link
                      href={`/features/${encodeURIComponent(f.featureHandle)}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {f.featureTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
              {(user.trackedFeatures?.length ?? 0) === 0 && (
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
