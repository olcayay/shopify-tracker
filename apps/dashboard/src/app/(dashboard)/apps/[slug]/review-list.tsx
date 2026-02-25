"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { TablePagination } from "@/components/pagination";

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

        <TablePagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
