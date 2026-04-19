import type {
	PageObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

// ── デフォルト値の共通オプション型 ──────────────────────────────────────────

type WithDefault<T> = { default?: T | ((page: PageObjectResponse) => T) };

// ── カラム定義型 ─────────────────────────────────────────────────────────────

export type TitleColumnDef = { type: "title"; notion: string } & WithDefault<string>;
export type RichTextColumnDef = { type: "richText"; notion: string } & WithDefault<string>;
export type DateColumnDef = { type: "date"; notion: string } & WithDefault<string>;
export type NumberColumnDef = { type: "number"; notion: string } & WithDefault<number>;
export type CheckboxColumnDef = { type: "checkbox"; notion: string } & WithDefault<boolean>;
export type UrlColumnDef = { type: "url"; notion: string } & WithDefault<string>;
export type MultiSelectColumnDef = { type: "multiSelect"; notion: string } & WithDefault<string[]>;
export type SelectColumnDef<V extends Record<string, string> = Record<string, string>> = {
	type: "select";
	notion: string;
	values?: V;
	published?: string[];
	accessible?: string[];
} & WithDefault<string>;

export type ColumnDef =
	| TitleColumnDef
	| RichTextColumnDef
	| DateColumnDef
	| NumberColumnDef
	| CheckboxColumnDef
	| UrlColumnDef
	| MultiSelectColumnDef
	| SelectColumnDef;

export type SchemaMap = Record<string, ColumnDef>;

// ── 型推論ユーティリティ ──────────────────────────────────────────────────────

type HasDefault<C> = C extends { default: NonNullable<unknown> } ? true : false;

type ColBase<C extends ColumnDef> =
	C extends { type: "number" } ? number :
	C extends { type: "checkbox" } ? boolean :
	C extends { type: "multiSelect" } ? string[] :
	C extends SelectColumnDef<infer V> ?
		string extends V[keyof V] ? string :
		V[keyof V]
	: string;

export type InferColValue<C extends ColumnDef> =
	C extends { type: "multiSelect" | "checkbox" }
		? ColBase<C>
		: HasDefault<C> extends true
			? ColBase<C>
			: ColBase<C> | null;

export type InferSchemaType<S extends SchemaMap> =
	{ id: string; updatedAt: string } &
	{ [K in keyof S]: InferColValue<S[K]> };

// ── NotionSchema オブジェクト型 ──────────────────────────────────────────────

export interface NotionSchema<T> {
	_columns: SchemaMap;
	mapItem: (page: PageObjectResponse) => T;
	publishedStatuses: readonly string[];
	accessibleStatuses: readonly string[];
}

// ── col ヘルパー ─────────────────────────────────────────────────────────────

export const col = {
	title: (notion: string, opts?: WithDefault<string>): TitleColumnDef =>
		({ type: "title", notion, ...opts }),
	richText: (notion: string, opts?: WithDefault<string>): RichTextColumnDef =>
		({ type: "richText", notion, ...opts }),
	date: (notion: string, opts?: WithDefault<string>): DateColumnDef =>
		({ type: "date", notion, ...opts }),
	number: (notion: string, opts?: WithDefault<number>): NumberColumnDef =>
		({ type: "number", notion, ...opts }),
	checkbox: (notion: string, opts?: WithDefault<boolean>): CheckboxColumnDef =>
		({ type: "checkbox", notion, ...opts }),
	url: (notion: string, opts?: WithDefault<string>): UrlColumnDef =>
		({ type: "url", notion, ...opts }),
	multiSelect: (notion: string, opts?: WithDefault<string[]>): MultiSelectColumnDef =>
		({ type: "multiSelect", notion, ...opts }),
	select: <V extends Record<string, string>>(
		notion: string,
		opts?: {
			values?: V;
			published?: Array<V[keyof V]>;
			accessible?: Array<V[keyof V]>;
			default?: string | ((page: PageObjectResponse) => string);
		},
	): SelectColumnDef<V> => ({ type: "select", notion, ...(opts as object) } as SelectColumnDef<V>),
};

// ── defineSchema 関数 ────────────────────────────────────────────────────────

export function defineSchema<
	S extends SchemaMap & {
		slug: ColumnDef;
		status: ColumnDef;
		publishedAt: ColumnDef;
	},
>(columns: S): NotionSchema<InferSchemaType<S>> {
	const published: string[] = [];
	const accessible: string[] = [];
	for (const colDef of Object.values(columns)) {
		if (colDef.type === "select" && "published" in colDef) {
			published.push(...(colDef.published ?? []));
			accessible.push(...(colDef.accessible ?? colDef.published ?? []));
		}
	}

	return {
		_columns: columns,
		mapItem: (page) => parseSchema(page, columns) as InferSchemaType<S>,
		publishedStatuses: published,
		accessibleStatuses: accessible,
	};
}

// ── Notionプロパティパーサー ──────────────────────────────────────────────────

type PropertyValue = PageObjectResponse["properties"][string];

function getPlainText(items: RichTextItemResponse[] | undefined): string {
	return items?.map((item) => item.plain_text).join("") ?? "";
}

function parseSchema(page: PageObjectResponse, columns: SchemaMap): Record<string, unknown> {
	const result: Record<string, unknown> = {
		id: page.id,
		updatedAt: page.last_edited_time,
	};
	for (const [key, colDef] of Object.entries(columns)) {
		result[key] = parseProperty(page, page.properties[colDef.notion], colDef);
	}
	return result;
}

function parseProperty(
	page: PageObjectResponse,
	prop: PropertyValue | undefined,
	colDef: ColumnDef,
): unknown {
	const resolveDefault = (implicitFallback: unknown) => {
		if ("default" in colDef && colDef.default !== undefined) {
			return typeof colDef.default === "function" ? colDef.default(page) : colDef.default;
		}
		return implicitFallback;
	};

	if (!prop) {
		if (colDef.type === "checkbox") return resolveDefault(false);
		if (colDef.type === "multiSelect") return resolveDefault([]);
		return resolveDefault(null);
	}

	switch (colDef.type) {
		case "title": {
			const v = getPlainText(prop.type === "title" ? prop.title : []);
			return v || resolveDefault(null);
		}
		case "richText": {
			const v = getPlainText(prop.type === "rich_text" ? prop.rich_text : []);
			return v || resolveDefault(null);
		}
		case "date": {
			const v = prop.type === "date" ? prop.date?.start ?? null : null;
			return v ?? resolveDefault(null);
		}
		case "number": {
			const v = prop.type === "number" ? prop.number : null;
			return v ?? resolveDefault(null);
		}
		case "checkbox":
			return prop.type === "checkbox" ? prop.checkbox : false;
		case "url": {
			const v = prop.type === "url" ? prop.url : null;
			return v ?? resolveDefault(null);
		}
		case "multiSelect":
			return prop.type === "multi_select" ? prop.multi_select.map((s) => s.name) : [];
		case "select": {
			const raw =
				prop.type === "select"
					? prop.select?.name ?? ""
					: prop.type === "status"
						? (prop as { status?: { name: string } }).status?.name ?? ""
						: "";
			if (!raw) return resolveDefault("");
			return colDef.values && raw in colDef.values ? colDef.values[raw] : raw;
		}
	}
}
