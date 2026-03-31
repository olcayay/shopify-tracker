import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-24 px-4 md:px-6">
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 to-blue-600 p-10 md:p-14 text-white text-center">
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-white/10" />

        <div className="relative">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Outrank Your Competition?
          </h2>
          <p className="mt-4 text-white/75 max-w-xl mx-auto text-lg">
            Stop guessing, start growing. Set up in minutes, see results
            immediately.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="text-base px-8 h-12 bg-white text-violet-700 hover:bg-white/90"
              asChild
            >
              <Link href="/register">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              className="text-base px-8 h-12 bg-white/15 text-white border border-white/25 hover:bg-white/25"
              asChild
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
