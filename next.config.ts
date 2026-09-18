import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Dev и production build не должны делить одну папку `.next`.
// Иначе `next start` / `next build` затирают кэш `next dev` — пропадают CSS и чанки,
// локально «падает» дизайн. В dev пишем в `.next-dev`.
// NODE_ENV надёжнее process.argv: дочерний start-server.js не всегда содержит "dev".
const useDevDir =
  process.env.NODE_ENV === "development" ||
  process.env.npm_lifecycle_event === "dev";

const nextConfig: NextConfig = {
  distDir: useDevDir ? ".next-dev" : ".next",
  outputFileTracingRoot: projectRoot,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 200, 256, 300, 384],
    minimumCacheTTL: 2592000,
  },
  // Уникальные URL логотипа на оффер (требование YML), один статический файл.
  async rewrites() {
    return [{ source: "/yml-pic/:slug", destination: "/images/yml-logo.png" }];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.next-dev/**",
          "**/public/images/**/data/**",
          "**/public/images/services/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
