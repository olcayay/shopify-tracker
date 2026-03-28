import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function StudioLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-40" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
