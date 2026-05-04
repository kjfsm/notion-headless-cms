// embed の URL を見て YouTube かそれ以外かを判定する軽量ユーティリティ。
// YouTube だけ専用プレーヤーを使い、それ以外は OG カードに流す方針。

const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
];

function safeUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

/** YouTube の URL かどうかを判定する。 */
export function isYouTubeUrl(url: string): boolean {
  const u = safeUrl(url);
  if (!u) return false;
  return YT_HOSTS.includes(u.hostname.toLowerCase());
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
