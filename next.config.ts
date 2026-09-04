import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wlhmgtnelqhzqyrphadd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  transpilePackages: ["lucide-react"],
  serverExternalPackages: ["@react-email/render", "@react-email/components", "resend"],
  typescript: {
    // TEMPORARY UNBLOCK — Vercel's build-time TS validation step hangs (45+ min
    // on b917828 in May 2026; 26+ min again on PR #146 in September) while the
    // identical `npm run build` finishes in ~8 min in GitHub CI and local
    // `tsc --noEmit` returns clean in seconds. The hang is specific to Vercel's
    // environment, not to the code.
    //
    // This does NOT drop the type gate: .github/workflows/ci.yml runs
    // `npx tsc --noEmit` as its own step in the quality job, so a type error
    // still fails the PR. It only stops Vercel re-running that check on deploy.
    //
    // Revert once the Vercel TS-step slowness is actually diagnosed -- this has
    // been "temporary" since May, and every branch cut from main rediscovers it
    // because the fix has never landed on main.
    ignoreBuildErrors: true,
  },
  experimental: {
    // isolatedDevBuild (Next.js 16 default: true) moves dev output to .next/dev/
    // but webpack's cache strategy fails to create the nested subdirectories on macOS.
    // Disable until upstream fix lands.
    isolatedDevBuild: false,
  },
  webpack: (config) => {
    // Next barrel-optimizer resolves lucide-react to dist/esm/lucide-react.js which can be
    // missing (ENOENT). Alias that path to the package name so resolution uses package.json exports.
    config.resolve.alias = {
      ...config.resolve.alias,
      "lucide-react/dist/esm/lucide-react.js": "lucide-react",
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'publickey-credentials-get=*, publickey-credentials-create=*',
          },
        ],
      },
    ];
  },
  async redirects() {
    // Customer vocabulary is "events" — the route was /crm, briefly /productions, now /events.
    // Keep both legacy paths flowing forward so external bookmarks survive.
    return [
      { source: '/crm', destination: '/events', permanent: true },
      { source: '/crm/:path*', destination: '/events/:path*', permanent: true },
      { source: '/productions', destination: '/events', permanent: true },
      // Run-of-show used to live at /productions/[eventId]; it now nests under
      // the event studio. The /deal/* and other sub-paths map directly.
      { source: '/productions/deal/:path*', destination: '/events/deal/:path*', permanent: true },
      { source: '/productions/archive', destination: '/events/archive', permanent: true },
      { source: '/productions/unmatched-replies', destination: '/events/unmatched-replies', permanent: true },
      { source: '/productions/:id', destination: '/events/:id/run-of-show', permanent: true },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
