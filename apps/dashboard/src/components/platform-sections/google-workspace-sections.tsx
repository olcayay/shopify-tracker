import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
              <a href={pd.supportUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.supportUrl}</a>
            </p>
          )}
          {pd?.developerWebsite && (
            <p>
              <span className="text-muted-foreground">Developer Website:</span>{" "}
              <a href={pd.developerWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.developerWebsite}</a>
            </p>
          )}
          {pd?.privacyPolicyUrl && (
            <p>
              <span className="text-muted-foreground">Privacy Policy:</span>{" "}
              <a href={pd.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.privacyPolicyUrl}</a>
            </p>
          )}
          {pd?.termsOfServiceUrl && (
            <p>
              <span className="text-muted-foreground">Terms of Service:</span>{" "}
              <a href={pd.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.termsOfServiceUrl}</a>
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
