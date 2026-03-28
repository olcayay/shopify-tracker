import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function RankingsLoading() {
  return (
    <div className="space-y-4">
      <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
    </div>
  );
}
