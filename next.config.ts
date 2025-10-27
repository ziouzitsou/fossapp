import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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

export default nextConfig;
