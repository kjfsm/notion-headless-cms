#!/usr/bin/env node
// Workers の /api/warm エンドポイントを叩いてキャッシュをウォームアップする
const url = `${process.env.WORKER_URL ?? "http://localhost:8787"}/api/warm`;
console.log(`POST ${url}`);
const res = await fetch(url, { method: "POST" });
if (!res.ok) {
	console.error(`エラー: ${res.status} ${res.statusText}`);
	process.exit(1);
}
const result = await res.json();
console.log(`完了: ok=${result.ok} failed=${result.failed}`);
