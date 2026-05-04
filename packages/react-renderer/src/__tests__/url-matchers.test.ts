import { describe, expect, it } from "vitest";
import {
  detectEmbedKind,
  extractVimeoId,
  extractYouTubeId,
} from "../lib/url-matchers";

describe("detectEmbedKind", () => {
  it("youtube ホストを検出する", () => {
    expect(detectEmbedKind("https://www.youtube.com/watch?v=abc")).toBe(
      "youtube",
    );
    expect(detectEmbedKind("https://youtu.be/xyz")).toBe("youtube");
  });
  it("vimeo / twitter / dlsite / steam を検出する", () => {
    expect(detectEmbedKind("https://vimeo.com/123")).toBe("vimeo");
    expect(detectEmbedKind("https://x.com/user/status/1")).toBe("twitter");
    expect(
      detectEmbedKind("https://www.dlsite.com/home/work/=/product_id/RJ1.html"),
    ).toBe("dlsite");
    expect(detectEmbedKind("https://store.steampowered.com/app/123/Foo/")).toBe(
      "steam",
    );
  });
  it("マッチしない URL は iframe", () => {
    expect(detectEmbedKind("https://example.com/foo")).toBe("iframe");
    expect(detectEmbedKind("not a url")).toBe("iframe");
  });
});

describe("extractYouTubeId", () => {
  it("watch?v=", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123",
    );
  });
  it("youtu.be 短縮", () => {
    expect(extractYouTubeId("https://youtu.be/xyz")).toBe("xyz");
  });
  it("/embed/, /shorts/", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/AAA")).toBe("AAA");
    expect(extractYouTubeId("https://www.youtube.com/shorts/BBB")).toBe("BBB");
  });
});

describe("extractVimeoId", () => {
  it("通常 URL から数値 ID を抽出", () => {
    expect(extractVimeoId("https://vimeo.com/76979871")).toBe("76979871");
  });
});
