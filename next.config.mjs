import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer }) => {
    // Suppress noisy optional require warning from face-api browser distribution
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@vladmandic\/face-api/ },
      /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    ];
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
