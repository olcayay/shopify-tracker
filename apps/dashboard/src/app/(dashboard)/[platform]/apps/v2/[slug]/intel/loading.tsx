import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function IntelLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader>
          <CardContent><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-32 mt-1" /></CardContent>
        </Card>
      ))}
    </div>
  );
}
