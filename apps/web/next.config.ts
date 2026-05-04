import type { NextConfig } from "next";

// ─── Bitwarden Secrets Manager variable mappings ────────────────────────────
// bws injects secrets under these names; Next.js needs specific names for
// client bundles (NEXT_PUBLIC_*) and server-side API routes.
// Run dev/build with:  bws run -- pnpm dev  (or pnpm build)
const nextConfig: NextConfig = {
  // fuse.js v7 is ESM-only — Next.js must transpile it for CJS bundles
  transpilePackages: ['fuse.js'],
  // Required for Docker production builds (copies minimal server + deps)
  output: 'standalone',
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ],
    }]
  },
  env: {
    // Supabase: bws uses bare names, Next.js client bundles need NEXT_PUBLIC_ prefix
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",

    // NUC backend: only set when the NUC is actually reachable.
    // Empty string = skip NUC, go straight to Open-Meteo/NDBC fallback.
    NUC_API_BASE_URL:
      process.env.NUC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "",
  },
};

export default nextConfig;
