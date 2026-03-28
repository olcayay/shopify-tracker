import { Skeleton } from "@/components/ui/skeleton";

export default function KeywordsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
