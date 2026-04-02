"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ResearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const router = useRouter();
  const platform = params.platform as string;

  useEffect(() => {
    Sentry.captureException(error, { tags: { platform } });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        {error.message || "Failed to load research project"}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" onClick={() => router.push(`/${platform}/research`)}>
          Back to Research
        </Button>
      </div>
    </div>
  );
}
