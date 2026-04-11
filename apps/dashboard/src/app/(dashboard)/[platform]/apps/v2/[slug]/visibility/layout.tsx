import { notFound } from "next/navigation";
import { VisibilitySubNav } from "./sub-nav";
import { hasServerFeature } from "@/lib/score-features-server";

export default async function VisibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasServerFeature("app-visibility"))) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <VisibilitySubNav />
      {children}
    </div>
  );
}
