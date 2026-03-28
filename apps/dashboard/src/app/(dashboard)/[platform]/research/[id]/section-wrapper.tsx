"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SectionWrapper({
  id, title, icon: Icon, subtitle, count, headerAction, titleHref, children,
}: {
  id?: string; title: string; icon: any; subtitle?: string; count?: number; headerAction?: React.ReactNode; titleHref?: string; children: React.ReactNode;
}) {
  return (
    <Card id={id} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 scroll-mt-6" role="region" aria-label={title}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" />
            {titleHref ? (
              <Link href={titleHref} className="hover:underline">{title}</Link>
            ) : (
              title
            )}
            {count != null && <Badge variant="secondary" className="text-xs font-normal">{count}</Badge>}
          </CardTitle>
          {headerAction}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
