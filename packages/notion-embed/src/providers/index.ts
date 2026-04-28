import type { EmbedProvider } from "../types";

export type { EmbedProvider } from "../types";

/**
 * EmbedProvider を作るヘルパー。型の補完が効くようにするためだけの薄いラッパー。
 * 直接オブジェクトリテラルでも作れるが、定義側で型推論が効かない局面があるため。
 */
export function defineEmbedProvider(provider: EmbedProvider): EmbedProvider {
  return provider;
}

/**
 * URL を順に provider にかけ、最初にマッチしたものを返す。
 * undefined を返した場合は呼び出し側で fallback (generic-iframe など) する。
 */
export function matchProvider(
  providers: readonly EmbedProvider[],
  url: string,
): EmbedProvider | undefined {
  for (const provider of providers) {
    if (provider.match(url)) return provider;
  }
  return undefined;
}

export { dlsiteProvider } from "./dlsite";
export { genericIframeProvider } from "./generic-iframe";
export { steamProvider } from "./steam";
export { twitterProvider } from "./twitter";
export { vimeoProvider } from "./vimeo";
export { youtubeProvider } from "./youtube";
