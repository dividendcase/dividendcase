/** @type {import('next').NextConfig} */
const nextConfig = {
  // Plain static files (site/out), so the site can be hosted anywhere
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@dividendcase/brand"],
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the workspace
  agentRules: false,
};

export default nextConfig;
