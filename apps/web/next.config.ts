import type { NextConfig } from "next";

// ─── Bitwarden Secrets Manager variable mappings ────────────────────────────
// bws injects secrets under these names; Next.js needs specific names for
// client bundles (NEXT_PUBLIC_*) and server-side API routes.
// Run dev/build with:  bws run -- pnpm dev  (or pnpm build)
const nextConfig: NextConfig = {
  // fuse.js v7 is ESM-only — Next.js must transpile it for CJS bundles
  transpilePackages: ['fuse.js'],
  env: {
    // Supabase: bws uses bare names, Next.js client bundles need NEXT_PUBLIC_ prefix
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",

    // NUC backend: bws uses NEXT_PUBLIC_API_URL; server routes use NUC_API_BASE_URL
    // Server-side URL for Next.js API routes: prefer the Docker-internal address
    NUC_API_BASE_URL:
      process.env.NUC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002",
  },
};

export default nextConfig;
