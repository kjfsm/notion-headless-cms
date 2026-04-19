/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import("@astrojs/cloudflare").Runtime<{
	NOTION_TOKEN: string;
	NOTION_DATA_SOURCE_ID: string;
	CACHE_BUCKET?: R2Bucket;
}>;

declare namespace App {
	interface Locals extends Runtime {}
}
