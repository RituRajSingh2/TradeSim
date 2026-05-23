import type { NextConfig } from 'next';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // ── Standalone output ────────────────────────────────────
  // Produces .next/standalone — a self-contained server with
  // minimal node_modules. Required by Dockerfile.web stage 3.
  output: 'standalone',

  // Ensure tracing captures node_modules hoisted to the monorepo root
  outputFileTracingRoot: path.join(__dirname, '../../'),

  transpilePackages: ['@tradesim/shared'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  // ── Security Headers ─────────────────────────────────────
  // Applied to every response. Tighten CSP per-route if needed.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Force HTTPS
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Disable FLoC / Topics API
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Content Security Policy
          // In dev: relaxed to allow HMR websocket connections
          // In prod: strict — self + trusted CDNs only
          {
            key: 'Content-Security-Policy',
            value: isDev
              ? `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:;`
              : `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self' wss: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
