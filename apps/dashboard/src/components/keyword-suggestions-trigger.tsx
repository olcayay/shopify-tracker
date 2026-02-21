"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { KeywordSuggestionsModal } from "@/components/keyword-suggestions-modal";

export function KeywordSuggestionsTrigger({
  keywordSlug,
  keyword,
  appSlug,
}: {
  keywordSlug: string;
  keyword: string;
  appSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Suggestions for "${keyword}"`}
        className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
      >
        <Lightbulb className="h-5 w-5 text-yellow-500" />
      </button>
      <KeywordSuggestionsModal
        keywordSlug={keywordSlug}
        keyword={keyword}
        appSlug={appSlug}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
