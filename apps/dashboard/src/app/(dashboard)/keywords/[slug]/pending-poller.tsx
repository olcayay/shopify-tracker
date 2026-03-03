"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TableSkeleton } from "@/components/skeletons";
import { Loader2 } from "lucide-react";

export function KeywordPendingPoller({ slug }: { slug: string }) {
  const router = useRouter();
  const { fetchWithAuth } = useAuth();

  useEffect(() => {
    let active = true;
    const poll = async () => {
      while (active) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!active) break;
        try {
          const res = await fetchWithAuth(`/api/keywords/${slug}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.latestSnapshot) {
            router.refresh();
            return;
          }
        } catch {
          // ignore
        }
      }
    };
    poll();
    return () => { active = false; };
  }, [slug, router, fetchWithAuth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Scraping keyword results... This usually takes a few seconds.
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={10} cols={5} />
        </CardContent>
      </Card>
    </div>
  );
}
