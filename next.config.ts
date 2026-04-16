import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Options for @sentry/nextjs — all optional. These are safe defaults that don't require
  // the Sentry CLI / auth token. Source maps upload will be skipped unless SENTRY_AUTH_TOKEN
  // is set (Vercel can populate that later).
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  widenClientFileUpload: true,
});
