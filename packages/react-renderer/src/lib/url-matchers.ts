// embed の URL を見て、専用コンポーネントを引き当てるための判定ユーティリティ。
// notion-embed の providers/* と互換性を保ちつつ、React 側で独立に扱うために再実装している。

const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
];
const VIMEO_HOSTS = ["vimeo.com", "player.vimeo.com"];
const TWITTER_HOSTS = ["twitter.com", "x.com", "www.twitter.com", "www.x.com"];
const DLSITE_HOSTS = [
  "dlsite.com",
  "www.dlsite.com",
  "dlsite.net",
  "www.dlsite.net",
];
const STEAM_HOSTS = ["store.steampowered.com", "steamcommunity.com"];

function safeUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export type EmbedKind =
  | "youtube"
  | "vimeo"
  | "twitter"
  | "dlsite"
  | "steam"
  | "iframe";

/** URL から embed の種別を判定。マッチしない場合は generic iframe 扱い。 */
export function detectEmbedKind(url: string): EmbedKind {
  const u = safeUrl(url);
  if (!u) return "iframe";
  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.includes(host)) return "youtube";
  if (VIMEO_HOSTS.includes(host)) return "vimeo";
  if (TWITTER_HOSTS.includes(host)) return "twitter";
  if (DLSITE_HOSTS.includes(host)) return "dlsite";
  if (STEAM_HOSTS.includes(host)) return "steam";
  return "iframe";
}

/** YouTube URL から videoId を抽出。失敗したら null。 */
export function extractYouTubeId(url: string): string | null {
  const u = safeUrl(url);
  if (!u) return null;
  if (u.hostname === "youtu.be") {
    return u.pathname.replace(/^\//, "") || null;
  }
  if (u.pathname === "/watch") {
    return u.searchParams.get("v");
  }
  // /embed/ID, /shorts/ID, /live/ID
  const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
  return m?.[1] ?? null;
}

/** Vimeo URL から videoId を抽出。 */
export function extractVimeoId(url: string): string | null {
  const u = safeUrl(url);
  if (!u) return null;
  const m = u.pathname.match(/(\d+)/);
  return m?.[1] ?? null;
}
