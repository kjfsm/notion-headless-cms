import type { BaseContentItem } from "./content";
import type { CMSHooks } from "./hooks";
import type { Logger } from "./logger";

export interface CMSPlugin<T extends BaseContentItem = BaseContentItem> {
	name: string;
	hooks?: CMSHooks<T>;
	logger?: Partial<Logger>;
}

export function definePlugin<T extends BaseContentItem>(
	plugin: CMSPlugin<T>,
): CMSPlugin<T> {
	return plugin;
}
