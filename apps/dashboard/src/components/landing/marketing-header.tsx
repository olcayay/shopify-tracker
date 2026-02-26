"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";

export function MarketingHeader() {
  const { user, isLoading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">AppRanks</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          {!isLoading && user ? (
            <Button asChild>
              <Link href="/overview">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu */}
        <button
          onClick={() => setOpen(true)}
          className="md:hidden h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-64 p-6">
            <VisuallyHidden.Root>
              <SheetTitle>Menu</SheetTitle>
            </VisuallyHidden.Root>
            <div className="flex flex-col gap-4 mt-8">
              {!isLoading && user ? (
                <Button asChild onClick={() => setOpen(false)}>
                  <Link href="/overview">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild onClick={() => setOpen(false)}>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link href="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
