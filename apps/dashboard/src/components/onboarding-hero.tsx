"use client";

import Link from "@/components/ui/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PLATFORM_IDS } from "@appranks/shared";
import { Rocket, Search, TrendingUp } from "lucide-react";

export function OnboardingHero() {
  return (
    <Card className="rounded-xl border-0 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <CardContent className="pt-8 pb-8 px-6 md:px-10">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-3">
            Welcome to AppRanks
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Track, analyze, and optimize your app store presence across{" "}
            {PLATFORM_IDS.length}+ marketplaces.
          </p>

          {/* Platform icons row */}
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {PLATFORM_IDS.map((pid) => {
              const d = PLATFORM_DISPLAY[pid];
              return (
                <div
                  key={pid}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${d.color}20` }}
                  title={d.label}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                </div>
              );
            })}
          </div>

          {/* 3-step onboarding */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-background border rounded-lg p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div className="font-medium text-sm">1. Choose Platform</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a marketplace to start tracking
              </p>
            </div>
            <div className="bg-background border rounded-lg p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="font-medium text-sm">2. Add Your App</div>
              <p className="text-xs text-muted-foreground mt-1">
                Search for your app by name
              </p>
            </div>
            <div className="bg-background border rounded-lg p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="font-medium text-sm">3. Track & Optimize</div>
              <p className="text-xs text-muted-foreground mt-1">
                Monitor keywords, competitors, rankings
              </p>
            </div>
          </div>

          <Link href={`/${PLATFORM_IDS[0]}/apps`}>
            <Button size="lg">
              Get Started — Add Your First App
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
