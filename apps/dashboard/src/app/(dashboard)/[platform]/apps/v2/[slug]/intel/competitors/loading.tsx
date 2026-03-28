import { Skeleton } from "@/components/ui/skeleton";

export default function CompetitorsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-64" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
