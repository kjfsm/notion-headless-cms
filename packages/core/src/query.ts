import type { BaseContentItem } from "./types/content";
import type { DataSourceAdapter } from "./types/source";

export interface QueryResult<T> {
	items: T[];
	total: number;
	page: number;
	perPage: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export class QueryBuilder<T extends BaseContentItem> {
	private readonly source: DataSourceAdapter<T>;
	private readonly defaultStatuses: string[];

	private _statuses: string[] = [];
	private _tags: string[] = [];
	private _predicate: ((item: T) => boolean) | undefined;
	private _sortField: (keyof T & string) | undefined;
	private _sortDir: "asc" | "desc" = "asc";
	private _page = 1;
	private _perPage = 20;

	constructor(source: DataSourceAdapter<T>, defaultStatuses: string[] = []) {
		this.source = source;
		this.defaultStatuses = defaultStatuses;
	}

	status(s: string | string[]): this {
		this._statuses = Array.isArray(s) ? s : [s];
		return this;
	}

	tag(t: string | string[]): this {
		this._tags = Array.isArray(t) ? t : [t];
		return this;
	}

	where(predicate: (item: T) => boolean): this {
		this._predicate = predicate;
		return this;
	}

	sortBy(field: keyof T & string, dir: "asc" | "desc" = "asc"): this {
		this._sortField = field;
		this._sortDir = dir;
		return this;
	}

	paginate(opts: { page: number; perPage: number }): this {
		this._page = opts.page;
		this._perPage = opts.perPage;
		return this;
	}

	async execute(): Promise<QueryResult<T>> {
		const statuses =
			this._statuses.length > 0
				? this._statuses
				: this.defaultStatuses.length > 0
					? this.defaultStatuses
					: undefined;

		// push-down: source.query が存在 かつ where() 未使用 → Notion API に委譲
		if (this.source.query && !this._predicate) {
			const result = await this.source.query({
				filter: {
					statuses,
					tags: this._tags.length > 0 ? this._tags : undefined,
				},
				sort: this._sortField
					? [{ property: this._sortField, direction: this._sortDir }]
					: undefined,
				pageSize: this._perPage,
			});
			const items = result.items;
			return {
				items,
				total: items.length,
				page: this._page,
				perPage: this._perPage,
				hasNext: result.hasMore,
				hasPrev: this._page > 1,
			};
		}

		// フォールバック: インメモリフィルタ
		let items = await this.source.list({
			publishedStatuses: statuses,
		});

		if (this._tags.length > 0) {
			items = items.filter((item) => {
				const itemTags = (item as Record<string, unknown>).tags;
				if (!Array.isArray(itemTags)) return false;
				return this._tags.some((tag) => (itemTags as string[]).includes(tag));
			});
		}

		if (this._predicate) {
			items = items.filter(this._predicate);
		}

		if (this._sortField) {
			const field = this._sortField;
			const dir = this._sortDir;
			items = [...items].sort((a, b) => {
				const av = a[field] as string | number;
				const bv = b[field] as string | number;
				const cmp = av < bv ? -1 : av > bv ? 1 : 0;
				return dir === "asc" ? cmp : -cmp;
			});
		}

		const total = items.length;
		const start = (this._page - 1) * this._perPage;
		const paged = items.slice(start, start + this._perPage);

		return {
			items: paged,
			total,
			page: this._page,
			perPage: this._perPage,
			hasNext: start + this._perPage < total,
			hasPrev: this._page > 1,
		};
	}

	async executeOne(): Promise<T | null> {
		const result = await this.execute();
		return result.items[0] ?? null;
	}

	/** 前後アイテムを返す。sortBy() で指定したソート順を適用する。 */
	async adjacent(slug: string): Promise<{ prev: T | null; next: T | null }> {
		const statuses =
			this._statuses.length > 0
				? this._statuses
				: this.defaultStatuses.length > 0
					? this.defaultStatuses
					: undefined;
		let items = await this.source.list({ publishedStatuses: statuses });

		if (this._sortField) {
			const field = this._sortField;
			const dir = this._sortDir;
			items = [...items].sort((a, b) => {
				const av = a[field] as string | number;
				const bv = b[field] as string | number;
				const cmp = av < bv ? -1 : av > bv ? 1 : 0;
				return dir === "asc" ? cmp : -cmp;
			});
		}

		const idx = items.findIndex((item) => item.slug === slug);
		if (idx === -1) return { prev: null, next: null };
		return {
			prev: idx > 0 ? items[idx - 1] : null,
			next: idx < items.length - 1 ? items[idx + 1] : null,
		};
	}

	/** 最初の 1 件を返す。`.paginate({ page: 1, perPage: 1 }).executeOne()` の短縮形。 */
	first(): Promise<T | null> {
		return this.paginate({ page: 1, perPage: 1 }).executeOne();
	}
}
