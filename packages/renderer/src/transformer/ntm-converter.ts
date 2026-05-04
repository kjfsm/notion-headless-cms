import type { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type { MdBlock } from "notion-to-md/build/types/index";
import type { BlockConverter } from "./converter";
import type { BlockHandler } from "./types";

/**
 * notion-to-md v3 を使った BlockConverter 実装。
 * カスタムブロックハンドラーは setCustomTransformer で登録する。
 *
 * ⚠️ v3 のカスタムトランスフォーマーはブロックのみ受け取るため、
 *    TransformContext.pageId は空文字列になる。
 *
 * ⚠️ toggle ブロックはカスタムトランスフォーマーがある場合に notion-to-md が
 *    children を取得しないため、pageToMarkdown 後に children を手動注入する。
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

    // toggle ブロックはカスタムトランスフォーマーがあると children が取得されないため
    // pageToMarkdown 後に Notion API から children を取得して注入する
    if (this.handlers.has("toggle")) {
      await this.injectToggleChildren(ntm, blocks);
    }

    // ブロックが空のとき toMarkdownString(blocks).parent は undefined になる
    return ntm.toMarkdownString(blocks).parent ?? "";
  }

  /**
   * toggle ブロックの children を再帰的に注入する。
   * notion-to-md のカスタムトランスフォーマーが toggle の children 取得をスキップするため、
   * pageToMarkdown 後にここで補完する。
   */
  private async injectToggleChildren(
    ntm: NotionToMarkdown,
    blocks: MdBlock[],
  ): Promise<void> {
    for (const block of blocks) {
      if (
        block.type === "toggle" &&
        block.children.length === 0 &&
        block.blockId
      ) {
        const response = await this.client.blocks.children.list({
          block_id: block.blockId,
        });
        if (response.results.length > 0) {
          await ntm.blocksToMarkdown(
            response.results as Parameters<typeof ntm.blocksToMarkdown>[0],
            null,
            block.children,
          );
        }
      }
      if (block.children.length > 0) {
        await this.injectToggleChildren(ntm, block.children);
      }
    }
  }
}
