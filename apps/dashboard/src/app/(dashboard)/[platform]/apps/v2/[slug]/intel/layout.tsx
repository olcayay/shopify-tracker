import { IntelSubNav } from "./sub-nav";

export default function IntelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <IntelSubNav />
      {children}
    </div>
  );
}
