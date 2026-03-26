"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyReportButtonProps {
  getReport: () => string;
  label?: string;
  className?: string;
  title?: string;
}

export function CopyReportButton({ getReport, label, className, title }: CopyReportButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(getReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={className || "flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 transition-colors"}
      title={title || "Copy debug report"}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}
