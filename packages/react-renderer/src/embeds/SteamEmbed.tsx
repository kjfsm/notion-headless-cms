"use client";

export interface SteamEmbedProps {
  url: string;
}

function extractSteamAppId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/app\/(\d+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function SteamEmbed({ url }: SteamEmbedProps) {
  const appId = extractSteamAppId(url);
  if (!appId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline"
      >
        {url}
      </a>
    );
  }
  return (
    <iframe
      src={`https://store.steampowered.com/widget/${appId}/`}
      title="Steam"
      className="w-full rounded-lg border"
      style={{ height: 190 }}
      frameBorder={0}
    />
  );
}
