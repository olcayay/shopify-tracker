import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">AppRanks</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Shopify App Store intelligence platform for app developers.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/register" className="hover:text-foreground transition-colors">
                  Get Started
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="mailto:support@appranks.io"
                  className="hover:text-foreground transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <p className="text-sm text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} AppRanks. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
