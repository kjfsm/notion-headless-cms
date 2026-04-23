/**
 * Notion API のカーソルページネーションを汎用的にたどり、
 * すべての `results` を連結した配列を返す。
 */
export async function paginate<T>(
	fetchPage: (cursor?: string) => Promise<{
		results: T[];
		has_more: boolean;
		next_cursor: string | null;
	}>,
): Promise<T[]> {
	const all: T[] = [];
	let cursor: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const response = await fetchPage(cursor);
		all.push(...response.results);
		hasMore = response.has_more;
		cursor = response.next_cursor ?? undefined;
	}

	return all;
}
