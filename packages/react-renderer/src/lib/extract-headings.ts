import type { NotionBlock } from "../types";

export interface ExtractedHeading {
  id: string;
  level: 1 | 2 | 3 | 4;
  text: string;
}

const LEVEL_BY_TYPE: Record<string, 1 | 2 | 3 | 4> = {
  heading_1: 1,
  heading_2: 2,
  heading_3: 3,
  heading_4: 4,
};

/** heading_1..4 を DFS 順に抽出する。is_toggleable 配下の見出しも含める（Notion 本家挙動）。 */
export function extractHeadings(blocks: NotionBlock[]): ExtractedHeading[] {
  const out: ExtractedHeading[] = [];
  walk(blocks, out);
  return out;
}

function walk(blocks: NotionBlock[], out: ExtractedHeading[]): void {
  for (const block of blocks) {
    const level = LEVEL_BY_TYPE[block.type];
    if (level) {
      const payload = (block as unknown as Record<string, { rich_text: { plain_text: string }[] }>)[
        block.type
      ];
      const text = payload?.rich_text.map((rt) => rt.plain_text).join("") ?? "";
      out.push({ id: block.id, level, text });
    }
    if (block.children?.length) walk(block.children, out);
  }
}
