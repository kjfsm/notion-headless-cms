// 先頭の `---\n...\n---` ブロックを解析する小さな YAML サブセットパーサ。
// gray-matter は `eval()` を使うため Cloudflare Workers で動かない。
// 我々の frontmatter は単純な `key: value` のみなので自前で十分。

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface ParsedFrontmatter {
  data: Record<string, string | number | boolean | null>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const m = raw.match(FENCE);
  if (!m) return { data: {}, content: raw };

  const yaml = m[1] ?? "";
  const content = raw.slice(m[0].length);
  const data: Record<string, string | number | boolean | null> = {};

  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    data[key] = coerce(rawValue);
  }

  return { data, content };
}

function coerce(s: string): string | number | boolean | null {
  if (s === "" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  // 整数 / 浮動小数
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // クォート除去
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
