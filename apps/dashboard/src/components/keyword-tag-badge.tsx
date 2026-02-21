"use client";

import { Badge } from "@/components/ui/badge";
import { getTagColorClasses } from "@/lib/tag-colors";
import { X } from "lucide-react";

interface KeywordTag {
  id: string;
  name: string;
  color: string;
}

export function KeywordTagBadge({
  tag,
  onRemove,
}: {
  tag: KeywordTag;
  onRemove?: () => void;
}) {
  const colors = getTagColorClasses(tag.color);
  return (
    <Badge
      className={`${colors.bg} ${colors.text} ${colors.border} text-[10px] px-1.5 py-0 h-4 gap-0.5`}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </Badge>
  );
}
