#!/usr/bin/env tsx
// README コード片のシンボル存在チェック
// 将来的な拡張: TypeScript コンパイラ API を使い、実際にシンボルが
// パッケージの dist/index.d.mts に存在するかを検証する
import * as fs from "node:fs";
import * as path from "node:path";

const readme = fs.readFileSync("README.md", "utf-8");

// README から import 文を抽出して、対象パッケージのシンボルを確認する
const importRegex =
  /import\s+\{([^}]+)\}\s+from\s+"(@notion-headless-cms\/[^"]+)"/g;

let failed = false;
const checked: string[] = [];

for (const match of readme.matchAll(importRegex)) {
  const symbols = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pkg = match[2];
  checked.push(`${pkg}: ${symbols.join(", ")}`);

  // パッケージが workspace に存在するか確認する
  // パッケージ名から packages/ ディレクトリ名を推定する
  const pkgDirName = pkg.replace("@notion-headless-cms/", "");
  const pkgPath = path.join("packages", pkgDirName);
  if (!fs.existsSync(pkgPath)) {
    console.error(
      `✗ パッケージ ${pkg} が workspace に見つかりません (${pkgPath})`,
    );
    failed = true;
  }
}

if (checked.length === 0) {
  console.log("README にチェック対象の import 文が見つかりません");
  process.exit(0);
}

console.log("チェック対象:");
for (const c of checked) {
  console.log(`  ${c}`);
}

if (failed) {
  process.exit(1);
}

console.log("\nOK: README のシンボルチェック完了");
