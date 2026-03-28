"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CompareSection({
  id, title, sectionKey, collapsed, onToggle, children,
}: {
  id: string; title: string; sectionKey: string; collapsed: boolean;
  onToggle: (key: string) => void; children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader
        className="pb-0 cursor-pointer select-none"
        onClick={() => onToggle(sectionKey)}
      >
        <CardTitle className="flex items-center justify-between text-sm">
          {title}
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      {!collapsed && <CardContent className="pt-3">{children}</CardContent>}
    </Card>
  );
}
