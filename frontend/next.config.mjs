/** @type {import('next').NextConfig} */
const nextConfig = {
  // Built as static files and served by the local Python app (see scripts/build_web.py).
  // Security headers are set by that server, since a static export can't carry them.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@dividendcase/brand"],
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the workspace
  agentRules: false,
};

export default nextConfig;
