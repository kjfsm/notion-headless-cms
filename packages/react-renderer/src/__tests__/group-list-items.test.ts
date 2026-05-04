import { describe, expect, it } from "vitest";
import { groupListItems } from "../lib/group-list-items";
import type { NotionBlock } from "../types";

const b = (id: string, type: NotionBlock["type"]): NotionBlock =>
  ({ id, type }) as unknown as NotionBlock;

describe("groupListItems", () => {
  it("連続した bulleted_list_item は ul にまとまる", () => {
    const groups = groupListItems([
      b("1", "bulleted_list_item"),
      b("2", "bulleted_list_item"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "ul" });
    expect(groups[0]?.kind === "ul" && groups[0].items).toHaveLength(2);
  });

  it("間に paragraph が挟まると ul は分割される", () => {
    const groups = groupListItems([
      b("1", "bulleted_list_item"),
      b("2", "paragraph"),
      b("3", "bulleted_list_item"),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["ul", "block", "ul"]);
  });

  it("bulleted と numbered は別グループに分かれる", () => {
    const groups = groupListItems([
      b("1", "bulleted_list_item"),
      b("2", "numbered_list_item"),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["ul", "ol"]);
  });
});
