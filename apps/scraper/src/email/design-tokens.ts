/** Shared design tokens for email templates */

export const colors = {
  primary: "#6366f1",
  primaryDark: "#4f46e5",
  dark: "#111827",
  darkMuted: "#6b7280",
  light: "#f9fafb",
  white: "#ffffff",
  border: "#e5e7eb",
  // Status
  green: "#10b981",
  greenBg: "#ecfdf5",
  red: "#ef4444",
  redBg: "#fef2f2",
  blue: "#3b82f6",
  blueBg: "#eff6ff",
  amber: "#f59e0b",
  amberBg: "#fffbeb",
  purple: "#8b5cf6",
  purpleBg: "#f5f3ff",
} as const;

export const fonts = {
  body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
} as const;

export const sizes = {
  maxWidth: "640px",
  borderRadius: "8px",
  padding: "24px",
  paddingSmall: "16px",
} as const;
