"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { LiveSearchModal } from "@/components/live-search-modal";

export function LiveSearchTrigger({
  keyword,
  variant = "button",
}: {
  keyword: string;
  variant?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setOpen(true)}
          title={`Live search: "${keyword}"`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5"
        >
          <Search className="h-4 w-4" />
          Live Search
        </Button>
      )}
      <LiveSearchModal
        keyword={keyword}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
