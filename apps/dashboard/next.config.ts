import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@appranks/shared"],
};

export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when no auth token is set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for readable stack traces in production
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Disable source map upload in dev (no auth token)
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
