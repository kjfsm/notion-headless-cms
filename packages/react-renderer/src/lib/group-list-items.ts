import type { NotionBlock } from "../types";

// 連続する list_item を <ul>/<ol> でグループ化するための中間表現。
// Notion API は list を 1 アイテム 1 ブロックで返すため、描画前に集約する必要がある。
export type ListGroup =
  | { kind: "ul"; items: NotionBlock[] }
  | { kind: "ol"; items: NotionBlock[] }
  | { kind: "block"; block: NotionBlock };

export function groupListItems(blocks: NotionBlock[]): ListGroup[] {
  const groups: ListGroup[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "bulleted_list_item") {
      if (last?.kind === "ul") {
        last.items.push(block);
      } else {
        groups.push({ kind: "ul", items: [block] });
      }
      continue;
    }
    if (block.type === "numbered_list_item") {
      if (last?.kind === "ol") {
        last.items.push(block);
      } else {
        groups.push({ kind: "ol", items: [block] });
      }
      continue;
    }
    groups.push({ kind: "block", block });
  }
  return groups;
}
