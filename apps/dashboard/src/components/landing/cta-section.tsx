import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-24 px-4 md:px-6">
      <div className="mx-auto max-w-3xl text-center rounded-2xl bg-muted/50 border p-8 md:p-12">
        <h2 className="text-3xl font-bold">
          Start Making Data-Driven Decisions
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Building a great Shopify app is only half the battle. The other half is
          knowing where you stand. AppRanks gives you the intelligence to compete
          and win.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/register">
              Create Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
