import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Providers } from "@/components/providers";
import { Analytics } from "@/components/analytics";
import { Toaster } from "sonner";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { CommandPalette } from "@/components/command-palette";
import { PostHogProvider } from "@/components/posthog-provider";
import { FeatureFlagsProvider } from "@/contexts/feature-flags-context";
import { UnhandledRejectionLogger } from "@/components/unhandled-rejection-logger";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://appranks.io";

export const metadata: Metadata = {
  title: {
    default: "AppRanks — App Marketplace Intelligence",
    template: "%s | AppRanks",
  },
  description:
    "Track rankings, monitor competitors, and optimize your app store presence across multiple marketplaces.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    siteName: "AppRanks",
    title: "AppRanks — App Marketplace Intelligence",
    description:
      "Track rankings, monitor competitors, and optimize your app store presence across multiple marketplaces.",
    url: BASE_URL,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "AppRanks" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AppRanks — App Marketplace Intelligence",
    description:
      "Track rankings, monitor competitors, and optimize your app store presence across multiple marketplaces.",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches))d.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UnhandledRejectionLogger />
        <Suspense>
          <Analytics />
        </Suspense>
        <Providers>
          <AuthProvider>
            <FeatureFlagsProvider>
              {children}
              <CommandPalette />
              <PostHogProvider />
            </FeatureFlagsProvider>
          </AuthProvider>
        </Providers>
        <Toaster richColors closeButton position="bottom-right" />
        <ShortcutsHelp />
      </body>
    </html>
  );
}
