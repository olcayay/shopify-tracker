import { StudioSubNav } from "./sub-nav";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <StudioSubNav />
      {children}
    </div>
  );
}
