import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function VisibilityLoading() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4"><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-24 mt-1" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
