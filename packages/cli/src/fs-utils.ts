import fs from "node:fs/promises";

/** ファイルが存在するかを判定する（fs.access の true/false ラッパー）。 */
export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
