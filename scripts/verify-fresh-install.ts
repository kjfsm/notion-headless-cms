#!/usr/bin/env tsx
// パッケージの dist/ ビルド済み成果物の存在チェック
// CI での fresh install 検証ではなく、ローカルでのビルド確認用スクリプト
import * as fs from "node:fs";
import * as path from "node:path";

const packages = [
  "core",
  "cache",
  "notion-source",
  "markdown-html",
  "block-html",
  "node",
  "cloudflare",
  "next",
  "cli",
];

let failed = false;
for (const pkg of packages) {
  const distPath = path.join("packages", pkg, "dist");
  if (!fs.existsSync(distPath)) {
    console.error(
      `✗ packages/${pkg}/dist が存在しません。pnpm build を実行してください`,
    );
    failed = true;
  } else {
    console.log(`✓ packages/${pkg}/dist`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("\nOK: 全パッケージのビルド成果物を確認");
