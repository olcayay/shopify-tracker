import Link from "next/link";
import { getApps } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AppsPage() {
  let apps: any[] = [];
  try {
    apps = await getApps();
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tracked Apps</h1>
        <p className="text-muted-foreground">Failed to load apps.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tracked Apps ({apps.length})</h1>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.slug}>
                  <TableCell>
                    <Link
                      href={`/apps/${app.slug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {app.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {app.latestSnapshot?.averageRating ?? "—"}
                  </TableCell>
                  <TableCell>
                    {app.latestSnapshot?.ratingCount ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {app.latestSnapshot?.pricing ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {app.latestSnapshot?.scrapedAt
                      ? new Date(
                          app.latestSnapshot.scrapedAt
                        ).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                </TableRow>
              ))}
              {apps.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No tracked apps. Add apps in the Admin panel.
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
