import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: [
		"@notion-headless-cms/adapter-next",
		"@notion-headless-cms/cache",
		"@notion-headless-cms/core",
		"@notion-headless-cms/notion-orm",
	],
};

export default nextConfig;
