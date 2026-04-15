import type { Client } from "@notionhq/client";
import { NotionConverter } from "notion-to-md";
import type { BaseRendererPlugin } from "notion-to-md/core";
import { MDXRenderer } from "notion-to-md/plugins/renderer";
import type { BlockHandler, TransformerConfig } from "./types";

/**
 * Notion Block → Markdown 変換クラス。
 * notion-to-md v4 をラップし、registerBlock でカスタムブロックハンドラーを登録できる。
 *
 * カスタムハンドラーを登録する場合は MDXRenderer を利用し、
 * テンプレートをコンテンツのみに設定して標準 Markdown に近い出力を得る。
 */
export class Transformer {
	private readonly customHandlers: Map<string, BlockHandler> = new Map();

	constructor(config?: TransformerConfig) {
		if (config?.blocks) {
			for (const [type, handler] of Object.entries(config.blocks)) {
				this.customHandlers.set(type, handler);
			}
		}
	}

	/**
	 * ブロックタイプにカスタムハンドラーを登録する。
	 * 同じタイプを再登録した場合は上書きされる。
	 */
	registerBlock(type: string, handler: BlockHandler): void {
		this.customHandlers.set(type, handler);
	}

	/**
	 * NotionページをMarkdownに変換する。
	 * notion-to-md が内部でサブブロックを取得するため client が必要。
	 * カスタムハンドラーが登録されている場合は MDXRenderer に登録して適用する。
	 */
	async transform(client: Client, pageId: string): Promise<string> {
		const n2m = new NotionConverter(client);

		if (this.customHandlers.size > 0) {
			// コンテンツのみを出力するテンプレートで MDXRenderer を設定する。
			const renderer: BaseRendererPlugin = new MDXRenderer().setTemplate(
				"{{{content}}}",
			);
			for (const [type, handler] of this.customHandlers) {
				renderer.createBlockTransformer(
					// notion-to-md の NotionBlockType は string のサブタイプ。
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					type as any,
					{
						transform: async (ctx: { block: unknown }) =>
							handler(ctx.block as Parameters<BlockHandler>[0], {
								client,
								pageId,
							}),
					},
				);
			}
			n2m.withRenderer(renderer);
		}

		const result = await n2m.convert(pageId);
		return result.content;
	}
}

/** 設定済みの Transformer インスタンスを生成するファクトリ関数。 */
export function createTransformer(config?: TransformerConfig): Transformer {
	return new Transformer(config);
}
