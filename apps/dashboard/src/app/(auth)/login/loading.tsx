import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex items-center justify-center">
      <Skeleton className="h-96 w-full max-w-md rounded-lg" />
    </div>
  );
}
