import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Head of Growth",
    company: "AppFlow Studio",
    quote: "AppRanks completely changed how we monitor our Shopify app. We caught a ranking drop within hours and fixed it before it impacted installs.",
  },
  {
    name: "Marcus Weber",
    role: "Product Manager",
    company: "CloudSync Tools",
    quote: "Tracking across 11 marketplaces from one dashboard saves us hours every week. The competitor tracking feature is incredibly valuable.",
  },
  {
    name: "Priya Sharma",
    role: "Founder",
    company: "PluginWorks",
    quote: "The keyword tracking helped us discover search terms we were missing. Our WordPress plugin went from page 3 to page 1 in two months.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">
            Trusted by app developers worldwide
          </h2>
          <p className="mt-2 text-muted-foreground">
            See how teams use AppRanks to grow their marketplace presence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name}>
              <CardContent className="pt-6">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.role}, {t.company}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
