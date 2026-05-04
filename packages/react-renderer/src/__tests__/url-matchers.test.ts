import { describe, expect, it } from "vitest";
import { extractYouTubeId, isYouTubeUrl } from "../lib/url-matchers";

describe("isYouTubeUrl", () => {
  it("YouTube ホストを判定する", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/xyz")).toBe(true);
    expect(isYouTubeUrl("https://m.youtube.com/watch?v=abc")).toBe(true);
  });
  it("YouTube 以外は false", () => {
    expect(isYouTubeUrl("https://vimeo.com/123")).toBe(false);
    expect(isYouTubeUrl("https://store.steampowered.com/app/1/")).toBe(false);
    expect(isYouTubeUrl("https://example.com")).toBe(false);
    expect(isYouTubeUrl("not a url")).toBe(false);
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
