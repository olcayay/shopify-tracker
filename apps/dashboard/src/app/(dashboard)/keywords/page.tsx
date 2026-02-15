import Link from "next/link";
import { getKeywords } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function KeywordsPage() {
  let keywords: any[] = [];
  try {
    keywords = await getKeywords();
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Keywords</h1>
        <p className="text-muted-foreground">Failed to load keywords.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tracked Keywords ({keywords.length})</h1>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Total Results</TableHead>
                <TableHead>Apps Found</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((kw) => (
                <TableRow key={kw.id}>
                  <TableCell>
                    <Link
                      href={`/keywords/${kw.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {kw.keyword}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {kw.latestSnapshot?.totalResults?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell>{kw.latestSnapshot?.appCount ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {kw.latestSnapshot?.scrapedAt
                      ? new Date(
                          kw.latestSnapshot.scrapedAt
                        ).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                </TableRow>
              ))}
              {keywords.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No tracked keywords. Add keywords in the Admin panel.
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
