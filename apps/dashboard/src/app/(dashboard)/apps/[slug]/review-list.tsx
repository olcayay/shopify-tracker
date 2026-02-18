"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

interface ReviewListProps {
  appSlug: string;
  initialReviews: any[];
  total: number;
}

export function ReviewList({ appSlug, initialReviews, total }: ReviewListProps) {
  const { fetchWithAuth } = useAuth();
  const [reviews, setReviews] = useState<any[]>(initialReviews);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchPage = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/apps/${appSlug}/reviews?limit=${PAGE_SIZE}&offset=${(p - 1) * PAGE_SIZE}&sort=newest`
        );
        const data = await res.json();
        if (data.reviews) {
          setReviews(data.reviews);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [appSlug, fetchWithAuth]
  );

  useEffect(() => {
    if (page === 1) return; // page 1 uses initialReviews
    fetchPage(page);
  }, [page, fetchPage]);

  const safePage = Math.min(page, totalPages);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Reviews ({total})</CardTitle>
        <AdminScraperTrigger
          scraperType="reviews"
          slug={appSlug}
          label="Scrape Reviews"
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reviews.map((review: any) => (
            <div
              key={review.id}
              className="border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{review.reviewerName}</span>
                  {review.reviewerCountry && (
                    <span className="text-sm text-muted-foreground">
                      {review.reviewerCountry}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{review.rating}★</Badge>
                  <span className="text-sm text-muted-foreground">
                    {review.reviewDate}
                  </span>
                </div>
              </div>
              {review.content && <p className="text-sm">{review.content}</p>}
              {review.durationUsingApp && (
                <p className="text-xs text-muted-foreground mt-1">
                  {review.durationUsingApp}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;
              {Math.min(safePage * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={safePage <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === safePage ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={loading}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={safePage >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
