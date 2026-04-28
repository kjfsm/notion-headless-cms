import type { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type { BlockConverter } from "./converter";
import type { BlockHandler } from "./types";

/**
 * notion-to-md v3 を使った BlockConverter 実装。
 * カスタムブロックハンドラーは setCustomTransformer で登録する。
 *
 * ⚠️ v3 のカスタムトランスフォーマーはブロックのみ受け取るため、
 *    TransformContext.pageId は空文字列になる。
 */
export class NtmConverter implements BlockConverter {
  private readonly client: Client;
  private readonly handlers: Map<string, BlockHandler>;

  constructor(client: Client, handlers: Map<string, BlockHandler>) {
    this.client = client;
    this.handlers = new Map(handlers);
  }

  registerBlock(type: string, handler: BlockHandler): void {
    this.handlers.set(type, handler);
  }

  async convert(pageId: string): Promise<string> {
    const ntm = new NotionToMarkdown({ notionClient: this.client });

    for (const [type, handler] of this.handlers) {
      ntm.setCustomTransformer(type, async (block) => {
        return handler(block as Parameters<BlockHandler>[0], {
          client: this.client,
          pageId: "",
        });
      });
    }

    const blocks = await ntm.pageToMarkdown(pageId);
    // ブロックが空のとき toMarkdownString(blocks).parent は undefined になる
    return ntm.toMarkdownString(blocks).parent ?? "";
  }
}
