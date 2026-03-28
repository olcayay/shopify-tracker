import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"salesforce">;

function SalesforceBadgeGrid({ platform, platformData: pd, snapshot }: Props) {
  const industries: string[] = pd?.supportedIndustries || [];
  const businessNeeds: string[] = Array.isArray(pd?.businessNeeds) ? pd.businessNeeds : [];
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
              {industries.map((ind) => {
                const slug = ind.toLowerCase().replace(/[\s&/]+/g, "-");
                return (
                  <Link key={ind} href={`/${platform}/discover/industry/${slug}`}>
                    <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                      {ind}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {businessNeeds.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Business Needs</p>
            <div className="flex flex-wrap gap-1">
              {businessNeeds.map((bn) => {
                const slug = bn.toLowerCase().replace(/[\s&/]+/g, "-");
                return (
                  <Link key={bn} href={`/${platform}/discover/business-need/${slug}`}>
                    <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                      {bn}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {productsRequired.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Requires</p>
            <div className="flex flex-wrap gap-1">
              {productsRequired.map((pr) => {
                const slug = pr.toLowerCase().replace(/[\s&/]+/g, "-");
                return (
                  <Link key={pr} href={`/${platform}/discover/product-required/${slug}`}>
                    <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                      {pr}
                    </Badge>
                  </Link>
                );
              })}
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
              {integrations.map((integ) => {
                const slug = integ.toLowerCase().replace(/[\s&/]+/g, "-");
                return (
                  <Link key={integ} href={`/${platform}/integrations/${slug}`}>
                    <Badge variant="secondary" className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                      {integ}
                    </Badge>
                  </Link>
                );
              })}
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
    shouldRender: ({ platformData: pd, snapshot }) => {
      const industries: string[] = pd?.supportedIndustries || [];
      const businessNeeds: string[] = Array.isArray(pd?.businessNeeds) ? pd.businessNeeds : [];
      const productsRequired: string[] = pd?.productsRequired || [];
      return industries.length > 0 || businessNeeds.length > 0 || productsRequired.length > 0 ||
        (snapshot.languages?.length > 0) || (snapshot.integrations?.length > 0);
    },
  },
];
