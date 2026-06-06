import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @keepra/shared is consumed from TypeScript source; Next transpiles it.
  transpilePackages: ['@keepra/shared'],
  webpack: (config) => {
    // The shared package uses NodeNext-style ".js" import specifiers that
    // actually resolve to ".ts" sources. Teach webpack to follow them.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
