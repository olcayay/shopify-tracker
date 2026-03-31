import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppWindow, Search, Star, FlaskConical, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface UsageStat {
  key: string;
  icon: LucideIcon;
  label: string;
  value: number;
  limit: number;
  colorClasses: { bg: string; text: string };
  href?: string;
  show?: boolean;
}

export const USAGE_STAT_PRESETS = {
  apps: { icon: AppWindow, label: "My Apps", colorClasses: { bg: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400", text: "text-blue-600 dark:text-blue-400" } },
  keywords: { icon: Search, label: "Tracked Keywords", colorClasses: { bg: "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400", text: "text-purple-600 dark:text-purple-400" } },
  competitors: { icon: Star, label: "Competitor Apps", colorClasses: { bg: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400", text: "text-amber-600 dark:text-amber-400" } },
  research: { icon: FlaskConical, label: "Research Projects", colorClasses: { bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400", text: "text-emerald-600 dark:text-emerald-400" } },
  users: { icon: Users, label: "Users", colorClasses: { bg: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400", text: "text-rose-600 dark:text-rose-400" } },
} as const;

interface AccountUsageCardsProps {
  stats: UsageStat[];
}

export function AccountUsageCards({ stats }: AccountUsageCardsProps) {
  const visible = stats.filter((s) => s.show !== false);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {visible.map((stat) => {
        const content = (
          <Card className={`h-full ${stat.href ? "hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer" : ""}`}>
            <CardHeader className="pb-2 items-center text-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.colorClasses.bg} mb-1`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-3xl tracking-tight">
                {stat.value}
                <span className="text-lg text-muted-foreground font-normal">
                  /{stat.limit}
                </span>
              </CardTitle>
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
          </Card>
        );

        if (stat.href) {
          return (
            <Link key={stat.key} href={stat.href} className="h-full">
              {content}
            </Link>
          );
        }

        return <div key={stat.key}>{content}</div>;
      })}
    </div>
  );
}
