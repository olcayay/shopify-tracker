"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  variant?: "icon" | "button";
  label?: string;
  size?: "xs" | "sm" | "default";
  successDuration?: number;
  className?: string;
}

export function CopyButton({
  value,
  variant = "icon",
  label = "Copy",
  size = "sm",
  successDuration = 2000,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), successDuration);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors",
          size === "xs" && "h-5 w-5",
          size === "sm" && "h-7 w-7",
          size === "default" && "h-8 w-8",
          className,
        )}
        title={copied ? "Copied!" : label}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size === "xs" ? "xs" : size}
      onClick={handleCopy}
      className={className}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span className="ml-1">{copied ? "Copied!" : label}</span>
    </Button>
  );
}
