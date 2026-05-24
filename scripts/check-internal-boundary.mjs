#!/usr/bin/env node
// Issue #315 (M4): packages/*/src/internal/** への外部 import を検出して exit 1。
//
// 同一パッケージ内の相対 import (./internal/..., ../internal/...) は許可する。
// 他パッケージへの参照は `@notion-headless-cms/<name>/internal/...` または、
// 相対パスで別パッケージの src/internal/** を指す形が違反対象。

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PACKAGES_DIR = join(ROOT, "packages");

/** ファイルが属するパッケージ名 (packages/<name>/) を返す。 */
function packageOf(filePath) {
  const rel = relative(PACKAGES_DIR, filePath);
  const seg = rel.split("/")[0];
  return seg;
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      await walk(p, out);
    } else if (/\.(ts|tsx|mts|cts)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const IMPORT_RE =
  /(?:import|export)\s+(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g;

/**
 * 同一パッケージ内の相対 import かどうかを判定する。
 * file と target を absolute 化して比較する。
 */
function isSamePackage(filePath, importerPkg, importedRelPath) {
  if (!importedRelPath.startsWith(".")) return false;
  const abs = resolve(dirname(filePath), importedRelPath);
  const targetPkg = packageOf(abs);
  return targetPkg === importerPkg;
}

const violations = [];

const pkgEntries = await readdir(PACKAGES_DIR, { withFileTypes: true });
for (const pkg of pkgEntries) {
  if (!pkg.isDirectory()) continue;
  const srcDir = join(PACKAGES_DIR, pkg.name, "src");
  let files;
  try {
    files = await walk(srcDir);
  } catch {
    continue;
  }
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const importerPkg = packageOf(file);
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1];
      // 1. @notion-headless-cms/<other>/internal/... は無条件で違反
      const scopedMatch = spec.match(
        /^@notion-headless-cms\/([^/]+)\/internal(?:\/|$)/,
      );
      if (scopedMatch) {
        if (scopedMatch[1] !== importerPkg) {
          violations.push({
            file: relative(ROOT, file),
            spec,
            reason: `他パッケージ (@notion-headless-cms/${scopedMatch[1]}) の internal/ を参照`,
          });
        }
        continue;
      }
      // 2. 相対 import で別パッケージの internal/ を踏むケース
      if (spec.startsWith(".") && spec.includes("internal")) {
        if (!isSamePackage(file, importerPkg, spec)) {
          violations.push({
            file: relative(ROOT, file),
            spec,
            reason: "相対 import で別パッケージの internal/ を参照",
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("internal/ 越境 import を検出しました (Issue #315 / M4):\n");
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    -> ${v.spec}`);
    console.error(`    ${v.reason}\n`);
  }
  process.exit(1);
}

console.log("internal/ 越境 import: 違反なし");
