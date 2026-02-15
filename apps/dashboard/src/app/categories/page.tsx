import Link from "next/link";
import { getCategories } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CategoriesPage() {
  let categories: any[] = [];
  try {
    categories = await getCategories("flat");
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground">Failed to load categories.</p>
      </div>
    );
  }

  // Group by level
  const roots = categories.filter((c) => c.categoryLevel === 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categories ({categories.length})</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-right">Tracked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.slug}>
                  <TableCell>
                    <Link
                      href={`/categories/${cat.slug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {"  ".repeat(cat.categoryLevel)}
                      {cat.title}
                    </Link>
                  </TableCell>
                  <TableCell>{cat.categoryLevel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cat.parentSlug || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {cat.isTracked ? "Yes" : "No"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
