import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function DashboardFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto">
      {/* Platform color gradient divider */}
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, #96bf48 0%, #00A1E0 20%, #0C65E3 40%, #FF7A59 60%, #00C4CC 80%, #96bf48 100%)",
          opacity: 0.3,
        }}
      />

      <div className="bg-muted/30 px-4 py-3">
        {/* Desktop: single row */}
        <div className="hidden md:flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="font-medium">AppRanks</span>
          </div>

          <nav className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span>·</span>
            <a href="mailto:support@appranks.io" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </nav>

          <span>© {year} AppRanks</span>
        </div>

        {/* Mobile: stacked */}
        <div className="flex flex-col items-center gap-1.5 md:hidden text-xs text-muted-foreground">
          <nav className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span>·</span>
            <a href="mailto:support@appranks.io" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </nav>
          <span>© {year} AppRanks</span>
        </div>
      </div>
    </footer>
  );
}
