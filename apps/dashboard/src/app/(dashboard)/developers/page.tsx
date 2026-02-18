"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DeveloperAppsPage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading...</p>}
    >
      <DeveloperAppsContent />
    </Suspense>
  );
}

function DeveloperAppsContent() {
  const searchParams = useSearchParams();
  const developerName = searchParams.get("name") || "";
  const { fetchWithAuth } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!developerName) {
      setLoading(false);
      return;
    }
    loadApps();
  }, [developerName]);

  async function loadApps() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/apps/by-developer?name=${encodeURIComponent(developerName)}`
    );
    if (res.ok) {
      setApps(await res.json());
    }
    setLoading(false);
  }

  if (!developerName) {
    return <p className="text-muted-foreground">No developer specified.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Apps by {developerName}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{apps.length} Apps</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : apps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No apps found for this developer.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Pricing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app: any) => (
                  <TableRow key={app.slug}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.iconUrl && (
                          <img src={app.iconUrl} alt="" className="h-6 w-6 rounded shrink-0" />
                        )}
                        <Link
                          href={`/apps/${app.slug}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {app.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.averageRating != null
                        ? Number(app.averageRating).toFixed(1)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.ratingCount?.toLocaleString() ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.pricing ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
