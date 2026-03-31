import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  showIcon?: boolean;
  iconSize?: "sm" | "default";
  children?: React.ReactNode;
}

export function ExternalLink({
  href,
  showIcon = true,
  iconSize = "default",
  className,
  children,
  ...props
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 hover:underline",
        className,
      )}
      {...props}
    >
      {children}
      {showIcon && (
        <ExternalLinkIcon
          className={cn(
            "shrink-0",
            iconSize === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          )}
        />
      )}
    </a>
  );
}
