import type { EmbedProvider } from "../types";
import { escapeAttr, escapeHtml } from "./_internal";

const TWITTER_RE =
  /^https?:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/;

/**
 * Twitter/X ツイートの埋め込み。
 * Twitter の oEmbed API を使わず、blockquote + script の標準 embed HTML を返す。
 * JavaScript が動作する環境でのみレンダリングされる。
 */
export function twitterProvider(): EmbedProvider {
  return {
    id: "twitter",
    match: (url) => TWITTER_RE.test(url),
    render: ({ url }) => {
      const normalized = url.replace("twitter.com", "x.com");
      return {
        kind: "html",
        html:
          `<blockquote class="twitter-tweet" data-dnt="true">` +
          `<a href="${escapeAttr(normalized)}">${escapeHtml(normalized)}</a>` +
          `</blockquote>` +
          `<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>`,
      };
    },
    sanitizeSchema: {
      tagNames: ["blockquote", "script"],
      attributes: {
        blockquote: ["class", "data-dnt"],
        script: ["async", "src", "charset"],
        a: ["href"],
      },
      protocols: { href: ["https"], src: ["https"] },
    },
  };
}
