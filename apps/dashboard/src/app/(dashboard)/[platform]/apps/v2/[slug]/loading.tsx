import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function V2DashboardLoading() {
  return (
    <div className="space-y-4">
      {/* Health Score Bar skeleton */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Alerts skeleton */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
