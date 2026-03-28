import { VisibilitySubNav } from "./sub-nav";

export default function VisibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <VisibilitySubNav />
      {children}
    </div>
  );
}
