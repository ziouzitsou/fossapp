import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

/**
 * Build-time security check
 * Fails the build if auth bypass is enabled in production deployment context.
 *
 * Checks for actual production deployment (CI=true, VERCEL, DOCKER_BUILD, or explicit PRODUCTION_BUILD)
 * to avoid blocking local production builds for testing.
 */
const isProductionDeployment = process.env.NODE_ENV === 'production' && (
  process.env.CI === 'true' ||
  process.env.VERCEL === '1' ||
  process.env.DOCKER_BUILD === 'true' ||
  process.env.PRODUCTION_BUILD === 'true'
);

if (isProductionDeployment && process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
  throw new Error(
    '\n\n' +
    '🚨 SECURITY ERROR: NEXT_PUBLIC_BYPASS_AUTH=true is not allowed in production!\n' +
    'This setting bypasses authentication and would expose your app to unauthorized access.\n' +
    'Please remove NEXT_PUBLIC_BYPASS_AUTH from your production environment variables.\n\n'
  );
}

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {}, // Silence Turbopack warning

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Prevent clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevent MIME sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'deltalight.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.meyer-lighting.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fosswebservices.retool.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'hyppizgiozyyyelwdius.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withPWA(nextConfig);
