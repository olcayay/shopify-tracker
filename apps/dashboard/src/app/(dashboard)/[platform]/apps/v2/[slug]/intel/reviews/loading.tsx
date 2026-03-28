import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ReviewsLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4"><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-24 mt-1" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
    </div>
  );
}
