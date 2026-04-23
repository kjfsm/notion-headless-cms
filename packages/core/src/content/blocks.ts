/**
 * CMS 本文の中間表現 (AST)。
 *
 * DataSource が本文をこの配列にノーマライズして返す。
 * レンダラー (`blocksToHtml`) やカスタム React コンポーネントは
 * この型だけを扱えばよい。
 *
 * 対応が難しいブロック (Notion の column / synced block など) は
 * `{ type: "raw", html }` にフォールバックする。
 */
export type ContentBlock =
	| { type: "paragraph"; children: InlineNode[] }
	| { type: "heading"; level: 1 | 2 | 3; children: InlineNode[] }
	| { type: "image"; src: string; alt?: string; cachedHash?: string }
	| { type: "code"; lang?: string; value: string }
	| { type: "list"; ordered: boolean; items: ContentBlock[][] }
	| { type: "quote"; children: ContentBlock[] }
	| { type: "divider" }
	| { type: "raw"; html: string };

/** paragraph / heading 等の子に並ぶインラインノード。 */
export type InlineNode =
	| {
			type: "text";
			value: string;
			bold?: boolean;
			italic?: boolean;
			code?: boolean;
	  }
	| { type: "link"; url: string; children: InlineNode[] }
	| { type: "break" };

/**
 * `getItem({ include: { content: true } })` で返される本文。
 * blocks は常に同梱。html / markdown は遅延生成。
 */
export interface ContentResult {
	/** 本文の AST (第一級)。 */
	blocks: ContentBlock[];
	/** 遅延 HTML。renderer が必要な場合のみ呼ぶ。 */
	html(): Promise<string>;
	/** 遅延 Markdown。 */
	markdown(): Promise<string>;
}

/** 画像参照 (DataSource.resolveImageUrl に渡す)。 */
export interface ImageRef {
	/** 元の Notion 画像 URL (期限切れの可能性あり)。 */
	originalUrl: string;
	/** 関連するアイテム ID。 */
	itemId?: string;
}
