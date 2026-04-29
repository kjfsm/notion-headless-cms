// vercel.json の TypeScript 版。型安全に Vercel デプロイ設定を管理する。
// `npx ts-node vercel.ts` でオブジェクトを確認できる。
// 実際の適用は vercel.json に変換するか、このファイルを参照して手動反映する。

interface Header {
	key: string;
	value: string;
}

interface HeaderRule {
	source: string;
	headers: Header[];
}

interface CronJob {
	/** 呼び出す API ルートのパス */
	path: string;
	/** cron 式（UTC 基準） */
	schedule: string;
}

interface VercelConfig {
	version: 2;
	headers?: HeaderRule[];
	crons?: CronJob[];
}

const config: VercelConfig = {
	version: 2,
	headers: [
		{
			source: "/(.*)",
			headers: [
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "X-Frame-Options", value: "DENY" },
				{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				{ key: "X-XSS-Protection", value: "1; mode=block" },
			],
		},
	],
	// Notion Webhook を使わず定期再検証する場合のみ有効化する。
	// CRON_SECRET 環境変数を Vercel ダッシュボードで設定し、
	// /api/revalidate ルートで Authorization ヘッダーを検証すること。
	// crons: [
	//   { path: "/api/revalidate", schedule: "0 * * * *" },
	// ],
};

export default config;
