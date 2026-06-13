import type { NotionBlock } from "../types";

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
