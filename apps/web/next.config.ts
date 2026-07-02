import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@betterwrite/shared',
    '@betterwrite/db',
    '@betterwrite/ai',
    '@betterwrite/design-system',
    '@betterwrite/worker',
  ],
  typedRoutes: true,
};

export default nextConfig;
