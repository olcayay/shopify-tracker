import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformSection, PlatformSectionProps } from "./index";

function WordPressDescription({ platformData: pd, snapshot }: PlatformSectionProps) {
  const wpDescriptionHtml = pd?.description as string | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
      </CardHeader>
      <CardContent>
        {wpDescriptionHtml ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:text-sm [&_p]:mb-2 [&_a]:text-primary [&_a]:hover:underline"
            dangerouslySetInnerHTML={{ __html: wpDescriptionHtml }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{snapshot.appDetails}</p>
        )}
      </CardContent>
    </Card>
  );
}

export const wordpressSections: PlatformSection[] = [
  {
    id: "wordpress-description",
    component: WordPressDescription,
    shouldRender: ({ platformData: pd, snapshot }) =>
      !!(pd?.description || snapshot.appDetails),
  },
];
