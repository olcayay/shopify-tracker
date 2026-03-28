import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Building2, DollarSign } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"hubspot">;

function HubSpotAppInfo({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>App Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.productType && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Product Type</p>
              <p className="font-medium">{pd.productType}</p>
            </div>
          )}
          {pd?.connectionType && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Connection Type</p>
              <p className="font-medium">{pd.connectionType}</p>
            </div>
          )}
          {pd?.offeringId != null && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Offering ID</p>
              <p className="font-medium">{pd.offeringId}</p>
            </div>
          )}
        </div>
        {(pd?.certified || pd?.builtByHubSpot) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {pd?.certified && (
              <Badge variant="default" className="text-xs gap-1">
                <ShieldCheck className="h-3 w-3" /> Certified
              </Badge>
            )}
            {pd?.builtByHubSpot && (
              <Badge variant="default" className="text-xs gap-1">
                <Building2 className="h-3 w-3" /> Built by HubSpot
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PricingPlan {
  name: string;
  model: string[];
  monthlyPrice: number;
  features: string[];
}

function HubSpotPricingPlans({ platformData: pd }: Props) {
  const plans: PricingPlan[] = pd?.pricingPlans || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Plans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{plan.name}</p>
                <p className="font-medium text-sm">
                  {plan.monthlyPrice === 0 ? (
                    "Free"
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <DollarSign className="h-3 w-3" />
                      {plan.monthlyPrice}/mo
                    </span>
                  )}
                </p>
              </div>
              {plan.model.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {plan.model.map((m, j) => (
                    <Badge key={j} variant="secondary" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
              {plan.features.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                  {plan.features.map((f, j) => (
                    <li key={j}>- {f}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export const hubspotSections: PlatformSection[] = [
  {
    id: "hubspot-app-info",
    component: HubSpotAppInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.productType || pd?.connectionType || pd?.certified || pd?.builtByHubSpot || pd?.offeringId != null),
  },
  {
    id: "hubspot-pricing-plans",
    component: HubSpotPricingPlans,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.pricingPlans?.length),
  },
];
