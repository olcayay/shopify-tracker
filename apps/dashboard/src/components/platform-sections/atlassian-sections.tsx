import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Award, Bug } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"atlassian">;

function AtlassianAppInfo({ platformData: pd }: Props) {
  const compatibilities = pd?.compatibilities || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.paymentModel && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Payment Model</p>
              <p className="font-medium">
                {pd.paymentModel === "free" ? "Free" : pd.paymentModel === "atlassian" ? "Paid via Atlassian" : "Paid via Vendor"}
              </p>
            </div>
          )}
          {pd?.licenseType && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">License Type</p>
              <p className="font-medium">{pd.licenseType}</p>
            </div>
          )}
          {pd?.releaseDate && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Release Date</p>
              <p className="font-medium">{new Date(pd.releaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
            </div>
          )}
          {compatibilities.length > 0 && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Compatible With</p>
              <div className="flex flex-wrap gap-1">
                {compatibilities.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {c.application} {c.cloud ? "Cloud" : c.server ? "Server" : c.dataCenter ? "Data Center" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AtlassianTrustSignals({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trust Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {pd?.cloudFortified && (
            <Badge variant="default" className="text-xs gap-1">
              <Shield className="h-3 w-3" /> Cloud Fortified
            </Badge>
          )}
          {pd?.topVendor && (
            <Badge variant="default" className="text-xs gap-1">
              <Award className="h-3 w-3" /> Top Vendor
            </Badge>
          )}
          {pd?.bugBountyParticipant && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Bug className="h-3 w-3" /> Bug Bounty Participant
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AtlassianLinks({ platformData: pd }: Props) {
  const vendorLinks = pd?.vendorLinks as Record<string, string> | null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Links</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {pd?.vendorHomePage && (
            <p>
              <span className="text-muted-foreground">Developer Website:</span>{" "}
              <a href={pd.vendorHomePage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.vendorHomePage}</a>
            </p>
          )}
          {pd?.documentationUrl && (
            <p>
              <span className="text-muted-foreground">Documentation:</span>{" "}
              <a href={pd.documentationUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.documentationUrl}</a>
            </p>
          )}
          {pd?.eulaUrl && (
            <p>
              <span className="text-muted-foreground">EULA:</span>{" "}
              <a href={pd.eulaUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.eulaUrl}</a>
            </p>
          )}
          {vendorLinks?.privacy && (
            <p>
              <span className="text-muted-foreground">Privacy Policy:</span>{" "}
              <a href={vendorLinks.privacy} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{vendorLinks.privacy}</a>
            </p>
          )}
          {vendorLinks?.appStatusPage && (
            <p>
              <span className="text-muted-foreground">Status Page:</span>{" "}
              <a href={vendorLinks.appStatusPage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{vendorLinks.appStatusPage}</a>
            </p>
          )}
          {pd?.slaUrl && (
            <p>
              <span className="text-muted-foreground">SLA:</span>{" "}
              <a href={pd.slaUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.slaUrl}</a>
            </p>
          )}
          {pd?.trustCenterUrl && (
            <p>
              <span className="text-muted-foreground">Trust Center:</span>{" "}
              <a href={pd.trustCenterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.trustCenterUrl}</a>
            </p>
          )}
          {pd?.contactEmail && (
            <p>
              <span className="text-muted-foreground">Contact Email:</span>{" "}
              <a href={`mailto:${pd.contactEmail}`} className="text-primary hover:underline">{pd.contactEmail}</a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const atlassianSections: PlatformSection[] = [
  {
    id: "atlassian-app-info",
    component: AtlassianAppInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.paymentModel || pd?.licenseType || pd?.releaseDate || pd?.compatibilities?.length),
  },
  {
    id: "atlassian-trust-signals",
    component: AtlassianTrustSignals,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.cloudFortified || pd?.bugBountyParticipant || pd?.topVendor),
  },
  {
    id: "atlassian-links",
    component: AtlassianLinks,
    shouldRender: ({ platformData: pd }) => {
      const vl = pd?.vendorLinks as Record<string, string> | null;
      return !!(pd?.documentationUrl || pd?.eulaUrl || vl?.privacy || vl?.appStatusPage || pd?.slaUrl || pd?.trustCenterUrl || pd?.vendorHomePage || pd?.contactEmail);
    },
  },
];
