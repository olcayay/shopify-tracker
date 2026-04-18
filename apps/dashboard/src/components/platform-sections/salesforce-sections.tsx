import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"salesforce">;

/** Convert camelCase key to readable label (e.g. "customerService" → "Customer Service") */
function camelToLabel(s: string): string {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

/** Extract business needs as string[] regardless of whether stored as array or object */
function extractBusinessNeeds(pd: any): string[] {
  if (!pd?.businessNeeds) return [];
  if (Array.isArray(pd.businessNeeds)) return pd.businessNeeds;
  if (typeof pd.businessNeeds === "object") return Object.keys(pd.businessNeeds);
  return [];
}

function SalesforceBadgeGrid({ platform, platformData: pd, snapshot }: Props) {
  const industries: string[] = pd?.supportedIndustries || [];
  const businessNeeds: string[] = extractBusinessNeeds(pd);
  const productsRequired: string[] = pd?.productsRequired || [];
  const languages: string[] = snapshot.languages || [];
  const integrations: string[] = snapshot.integrations || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salesforce Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {industries.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Industries</p>
            <div className="flex flex-wrap gap-1">
              {industries.map((ind) => (
                <Link key={ind} href={`/${platform}/discover/industry/${encodeURIComponent(ind)}`}>
                  <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                    {ind}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
        {businessNeeds.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Business Needs</p>
            <div className="flex flex-wrap gap-1">
              {businessNeeds.map((bn) => (
                <Link key={bn} href={`/${platform}/discover/business-need/${encodeURIComponent(bn)}`}>
                  <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                    {camelToLabel(bn)}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
        {productsRequired.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Requires</p>
            <div className="flex flex-wrap gap-1">
              {productsRequired.map((pr) => (
                <Link key={pr} href={`/${platform}/discover/product-required/${encodeURIComponent(pr)}`}>
                  <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                    {pr}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
        {languages.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Languages</p>
            <div className="flex flex-wrap gap-1">
              {languages.map((lang) => (
                <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
              ))}
            </div>
          </div>
        )}
        {integrations.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Compatible With</p>
            <div className="flex flex-wrap gap-1">
              {integrations.map((integ) => (
                <Link key={integ} href={`/${platform}/integrations/${encodeURIComponent(integ)}`}>
                  <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                    {integ}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const salesforceSections: PlatformSection[] = [
  {
    id: "salesforce-badge-grid",
    component: SalesforceBadgeGrid,
    position: "bottom",
    shouldRender: ({ platformData: pd, snapshot }) => {
      const industries: string[] = pd?.supportedIndustries || [];
      const businessNeeds: string[] = Array.isArray(pd?.businessNeeds) ? pd.businessNeeds : [];
      const productsRequired: string[] = pd?.productsRequired || [];
      return industries.length > 0 || businessNeeds.length > 0 || productsRequired.length > 0 ||
        (snapshot.languages?.length > 0) || (snapshot.integrations?.length > 0);
    },
  },
];
