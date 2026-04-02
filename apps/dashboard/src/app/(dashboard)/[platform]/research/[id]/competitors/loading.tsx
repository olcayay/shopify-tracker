import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
