import type {
  MeetingNotesBlockObjectResponse,
  SyncedBlockBlockObjectResponse,
  TemplateBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import {
  renderMeetingNotes,
  renderSyncedBlock,
  renderTemplate,
} from "../../handlers/synced";

const blockBase = {
  object: "block" as const,
  id: "id",
  parent: { type: "page_id" as const, page_id: "p" },
  created_time: "",
  last_edited_time: "",
  created_by: { object: "user" as const, id: "u" },
  last_edited_by: { object: "user" as const, id: "u" },
  has_children: false,
  archived: false,
  in_trash: false,
};

const text = (s: string) => ({
  type: "text" as const,
  text: { content: s, link: null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: "default" as const,
  },
  plain_text: s,
  href: null,
});

describe("renderSyncedBlock", () => {
  it("synced_from が null ならオリジナル扱い", () => {
    const block: SyncedBlockBlockObjectResponse = {
      ...blockBase,
      type: "synced_block",
      synced_block: { synced_from: null },
    };
    const html = renderSyncedBlock(block);
    expect(html).toContain("nhc-synced-block--original");
  });

  it("synced_from があればミラー扱い", () => {
    const block: SyncedBlockBlockObjectResponse = {
      ...blockBase,
      type: "synced_block",
      synced_block: {
        synced_from: { type: "block_id", block_id: "abc" },
      },
    };
    const html = renderSyncedBlock(block);
    expect(html).not.toContain("nhc-synced-block--original");
    expect(html).toContain("nhc-synced-block");
  });
});

describe("renderTemplate", () => {
  it("rich_text を div で包む", async () => {
    const block: TemplateBlockObjectResponse = {
      ...blockBase,
      type: "template",
      template: { rich_text: [text("テンプレ")] },
    };
    const html = await renderTemplate(block);
    expect(html).toContain('class="nhc-template"');
    expect(html).toContain("テンプレ");
  });
});

describe("renderMeetingNotes", () => {
  it("meeting_notes は基本クラスのみ", () => {
    const block: MeetingNotesBlockObjectResponse = {
      ...blockBase,
      type: "meeting_notes",
      meeting_notes: {},
    };
    expect(renderMeetingNotes(block)).toBe(
      '<div class="nhc-meeting-notes"></div>',
    );
  });
});
