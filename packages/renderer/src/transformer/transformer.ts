import type { Client } from "@notionhq/client";
import type { BlockConverter } from "./converter";
import { NtmConverter } from "./ntm-converter";
import type { BlockHandler, TransformerConfig } from "./types";

/**
 * Notion Block → Markdown 変換クラス。
 * notion-to-md v3 をラップし、registerBlock でカスタムブロックハンドラーを登録できる。
 * converter オプションで代替実装に差し替え可能。
 */
export class Transformer {
	private readonly customHandlers: Map<string, BlockHandler> = new Map();
	private readonly converterFactory:
		| ((client: Client) => BlockConverter)
		| undefined;

	constructor(
		config?: TransformerConfig & {
			converter?: (client: Client) => BlockConverter;
		},
	) {
		if (config?.blocks) {
			for (const [type, handler] of Object.entries(config.blocks)) {
				this.customHandlers.set(type, handler);
			}
		}
		this.converterFactory = config?.converter;
	}

	/** ブロックタイプにカスタムハンドラーを登録する。同じタイプを再登録した場合は上書きされる。 */
	registerBlock(type: string, handler: BlockHandler): void {
		this.customHandlers.set(type, handler);
	}

	/** NotionページをMarkdownに変換する。 */
	async transform(client: Client, pageId: string): Promise<string> {
		const converter = this.converterFactory
			? this.converterFactory(client)
			: new NtmConverter(client, this.customHandlers);

		if (this.converterFactory) {
			for (const [type, handler] of this.customHandlers) {
				converter.registerBlock(type, handler);
			}
		}

		return converter.convert(pageId);
	}
}

/** 設定済みの Transformer インスタンスを生成するファクトリ関数。 */
export function createTransformer(config?: TransformerConfig): Transformer {
	return new Transformer(config);
}
