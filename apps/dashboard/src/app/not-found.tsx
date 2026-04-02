import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 max-w-md mx-auto text-center px-6">
      <FileQuestion className="h-16 w-16 text-muted-foreground/50" />
      <h1 className="text-4xl font-bold">404</h1>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-muted-foreground text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3 mt-4">
        <Button asChild>
          <Link href="/overview">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
