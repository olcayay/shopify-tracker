"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";

const RULES = [
  { label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { label: "Uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { label: "Lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
  { label: "Number", test: (pw: string) => /[0-9]/.test(pw) },
] as const;

const COLORS = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

export function PasswordStrength({ password }: { password: string }) {
  const results = useMemo(
    () => RULES.map((r) => ({ ...r, passed: r.test(password) })),
    [password],
  );
  const score = results.filter((r) => r.passed).length;

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {RULES.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? COLORS[score - 1] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <ul className="space-y-0.5">
        {results.map((r) => (
          <li
            key={r.label}
            className={`flex items-center gap-1.5 text-xs ${
              r.passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            }`}
          >
            {r.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
