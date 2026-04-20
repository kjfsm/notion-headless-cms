import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: [
		"@notion-headless-cms/adapter-next",
		"@notion-headless-cms/cache-next",
		"@notion-headless-cms/core",
		"@notion-headless-cms/source-notion",
	],
};

export default nextConfig;
