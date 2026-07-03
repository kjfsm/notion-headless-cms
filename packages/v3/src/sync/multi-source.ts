import { CMSError } from "../errors.js";
import type { EntryChange, SyncCoordinatorDeps } from "./coordinator.js";
import type { CollectionDriver } from "./notion-driver.js";

const SEPARATOR = ":";

function namespacedSlug(collection: string, slug: string): string {
  return `${collection}${SEPARATOR}${slug}`;
}

function splitNamespacedSlug(
  namespaced: string,
): { collection: string; slug: string } | null {
  const idx = namespaced.indexOf(SEPARATOR);
  if (idx === -1) return null;
  return {
    collection: namespaced.slice(0, idx),
    slug: namespaced.slice(idx + 1),
  };
}

interface MultiCursor {
  /** 現在処理中のコレクションキー。 */
  readonly c: string;
  /** そのコレクション内での Notion カーソル(null は先頭から)。 */
  readonly nc: string | null;
}

function parseCursor(
  cursor: string | null,
  collectionKeys: readonly string[],
): MultiCursor {
  if (!cursor) {
    return { c: collectionKeys[0] ?? "", nc: null };
  }
  return JSON.parse(cursor) as MultiCursor;
}

function serializeCursor(cursor: MultiCursor | null): string | null {
  return cursor ? JSON.stringify(cursor) : null;
}

export interface MultiSourceOptions {
  /** schema のコレクションキー順に消化する(合成カーソルの巡回順)。 */
  readonly drivers: Readonly<Record<string, CollectionDriver>>;
}

/**
 * 複数コレクションの `CollectionDriver` を束ね、単一の `SyncCoordinatorDeps`
 * (`sync/coordinator.ts`、無改修)へ合成する(#437 マルチソース同期)。
 *
 * - slug 名前空間化: coordinator を通る slug は `"{collection}:{slug}"`
 * - カーソル多重化: `{ c: 現在のコレクション, nc: Notion カーソル }` を JSON 化したものを
 *   coordinator の `cursor` として使う。現在コレクションが尽きたら同一呼び出し内で
 *   次のコレクションへ遷移する(chunked sync の `limit` はコレクション横断の総量)
 * - DO は Alarm を 1 つしか持てず `SyncScheduler.schedule` は「既存予約を置き換える」
 *   契約のため、コレクションごとに独立したコーディネータを立てると予約を潰し合う。
 *   単一コーディネータ + 合成 deps なら レートリミッタも厳密に共有できる
 */
export function createMultiSourceDeps(
  opts: MultiSourceOptions,
): SyncCoordinatorDeps {
  const collectionKeys = Object.keys(opts.drivers);

  function driverFor(collection: string): CollectionDriver {
    const driver = opts.drivers[collection];
    if (!driver) {
      throw new CMSError({
        code: "sync/unknown_collection",
        message: `unknown collection in multi-source deps: ${collection}`,
        context: { operation: "multiSourceDeps", collection },
      });
    }
    return driver;
  }

  return {
    async listChanged(cursor, limit) {
      if (collectionKeys.length === 0) return { changes: [], nextCursor: null };

      let current = parseCursor(cursor, collectionKeys);
      const changes: EntryChange[] = [];

      while (changes.length < limit) {
        const idx = collectionKeys.indexOf(current.c);
        if (idx === -1) {
          // 不明なコレクション(スキーマ変更等)は先頭から再開する。
          current = { c: collectionKeys[0] ?? "", nc: null };
          if (!current.c) break;
        }
        const driver = driverFor(current.c);
        const remaining = limit - changes.length;
        const result = await driver.listChanged(current.nc, remaining);
        for (const change of result.changes) {
          changes.push({
            slug: namespacedSlug(current.c, change.slug),
            lastEditedTime: change.lastEditedTime,
          });
        }

        if (result.nextCursor !== null) {
          // このコレクションにまだ続きがある(limit に達したか、差分が残っている)。
          return {
            changes,
            nextCursor: serializeCursor({
              c: current.c,
              nc: result.nextCursor,
            }),
          };
        }

        // このコレクションは打ち切り完了。次のコレクションへ同一呼び出し内で遷移する。
        const nextIdx = collectionKeys.indexOf(current.c) + 1;
        if (nextIdx >= collectionKeys.length) {
          return { changes, nextCursor: null };
        }
        current = { c: collectionKeys[nextIdx] as string, nc: null };
      }

      return {
        changes,
        nextCursor: serializeCursor(current),
      };
    },

    async listAllSlugs() {
      const all: string[] = [];
      for (const collection of collectionKeys) {
        const slugs = await driverFor(collection).listAllSlugs();
        all.push(...slugs.map((slug) => namespacedSlug(collection, slug)));
      }
      return all;
    },

    async listIndexedSlugs() {
      const all: string[] = [];
      for (const collection of collectionKeys) {
        const slugs = await driverFor(collection).listIndexedSlugs();
        all.push(...slugs.map((slug) => namespacedSlug(collection, slug)));
      }
      return all;
    },

    async syncEntry(change) {
      const parsed = splitNamespacedSlug(change.slug);
      if (!parsed) return;
      await driverFor(parsed.collection).syncEntry({
        slug: parsed.slug,
        lastEditedTime: change.lastEditedTime,
      });
    },

    async removeEntry(slug) {
      const parsed = splitNamespacedSlug(slug);
      if (!parsed) return;
      await driverFor(parsed.collection).removeEntry(parsed.slug);
    },
  };
}
