import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="py-16 px-4 md:px-6 mx-auto max-w-6xl space-y-8">
      <div className="text-center space-y-3">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
