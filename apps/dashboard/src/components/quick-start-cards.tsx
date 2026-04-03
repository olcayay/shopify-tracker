"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Search, Key, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickStartCardsProps {
  trackedApps: number;
  trackedKeywords: number;
  competitors: number;
}

export function QuickStartCards({ trackedApps, trackedKeywords, competitors }: QuickStartCardsProps) {
  const { platform } = useParams();

  // Only show when user has zero data
  if (trackedApps > 0 || trackedKeywords > 0 || competitors > 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <Search className="h-8 w-8 text-primary/60 mb-1" />
          <CardTitle className="text-base">Track Your First App</CardTitle>
          <CardDescription className="text-xs">
            Search for your app and start monitoring rankings, reviews, and competitors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" asChild>
            <Link href={`/${platform}/apps`}>Search Apps</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <Key className="h-8 w-8 text-primary/60 mb-1" />
          <CardTitle className="text-base">Add Keywords</CardTitle>
          <CardDescription className="text-xs">
            Track keywords to see where your app ranks in search results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/${platform}/keywords`}>Add Keywords</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <Users className="h-8 w-8 text-primary/60 mb-1" />
          <CardTitle className="text-base">Track Competitors</CardTitle>
          <CardDescription className="text-xs">
            Monitor competitor apps to stay ahead with ranking and feature comparisons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/${platform}/competitors`}>View Competitors</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
