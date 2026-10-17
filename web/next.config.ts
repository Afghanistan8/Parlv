import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the tracing root to this package so a lockfile elsewhere on the machine
// cannot change which files Next.js traces into the production build.
const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
};

export default nextConfig;
