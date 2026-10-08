import type { NextConfig } from "next";

/**
 * Server Actions reject requests whose Origin doesn't match the Host the server sees. Behind a preview
 * proxy the two can differ, which made every form (including the demo sign-in buttons) fail with
 * "Invalid Server Actions request". Allow the preview domains here.
 *
 * For a real deployment set ALLOWED_ORIGINS to the exact public hostname(s), comma separated
 * (for example "consular.example.go.ke") and remove the wildcard preview entries.
 */
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Optional case attachments are limited to 2 MB each (validated again on the server).
      bodySizeLimit: "3mb",
      allowedOrigins: ["*.e2b.app", "*.e2b.dev", "localhost:3000", "127.0.0.1:3000", ...extraOrigins],
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
