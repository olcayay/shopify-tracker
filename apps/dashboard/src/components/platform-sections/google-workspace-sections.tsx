import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "@/components/ui/external-link";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"google_workspace">;

function GoogleWorkspaceLinks({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Links</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {pd?.supportUrl && (
            <p>
              <span className="text-muted-foreground">Support:</span>{" "}
              <ExternalLink href={pd.supportUrl} showIcon={false} className="text-primary">{pd.supportUrl}</ExternalLink>
            </p>
          )}
          {pd?.developerWebsite && (
            <p>
              <span className="text-muted-foreground">Developer Website:</span>{" "}
              <ExternalLink href={pd.developerWebsite} showIcon={false} className="text-primary">{pd.developerWebsite}</ExternalLink>
            </p>
          )}
          {pd?.privacyPolicyUrl && (
            <p>
              <span className="text-muted-foreground">Privacy Policy:</span>{" "}
              <ExternalLink href={pd.privacyPolicyUrl} showIcon={false} className="text-primary">{pd.privacyPolicyUrl}</ExternalLink>
            </p>
          )}
          {pd?.termsOfServiceUrl && (
            <p>
              <span className="text-muted-foreground">Terms of Service:</span>{" "}
              <ExternalLink href={pd.termsOfServiceUrl} showIcon={false} className="text-primary">{pd.termsOfServiceUrl}</ExternalLink>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const googleWorkspaceSections: PlatformSection[] = [
  {
    id: "gws-links",
    component: GoogleWorkspaceLinks,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.supportUrl || pd?.privacyPolicyUrl || pd?.termsOfServiceUrl || pd?.developerWebsite),
  },
];
