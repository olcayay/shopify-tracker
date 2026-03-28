"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SubNavItem {
  label: string;
  href: string;
}

export function SubNavPills({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  if (items.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
