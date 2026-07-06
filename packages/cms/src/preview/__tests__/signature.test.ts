import { describe, expect, it } from "vitest";

import { createPreviewUrl, verifyPreviewSignature } from "../signature.js";

const SECRET = "s3cr3t";

describe("createPreviewUrl / verifyPreviewSignature", () => {
  it("発行した URL の sig/exp で検証が通る", async () => {
    const now = 1_000_000;
    const url = await createPreviewUrl("https://x/api/cms/preview/posts/hello", {
      secret: SECRET,
      collection: "posts",
      slug: "hello",
      now,
    });
    const parsed = new URL(url);
    const sig = parsed.searchParams.get("sig");
    const exp = parsed.searchParams.get("exp");
    expect(sig).toBeTruthy();
    expect(exp).toBeTruthy();

    const valid = await verifyPreviewSignature({
      secret: SECRET,
      collection: "posts",
      slug: "hello",
      expiresAt: Number(exp),
      signature: sig ?? "",
      now,
    });
    expect(valid).toBe(true);
  });

  it("期限切れなら false", async () => {
    const now = 1_000_000;
    const url = await createPreviewUrl("https://x/preview/posts/hello", {
      secret: SECRET,
      collection: "posts",
      slug: "hello",
      ttlMs: 1000,
      now,
    });
    const parsed = new URL(url);
    const valid = await verifyPreviewSignature({
      secret: SECRET,
      collection: "posts",
      slug: "hello",
      expiresAt: Number(parsed.searchParams.get("exp")),
      signature: parsed.searchParams.get("sig") ?? "",
      now: now + 2000, // 期限(1000ms)を過ぎた時刻
    });
    expect(valid).toBe(false);
  });

  it("collection/slug が違えば署名不一致で false", async () => {
    const now = 1_000_000;
    const url = await createPreviewUrl("https://x/preview/posts/hello", {
      secret: SECRET,
      collection: "posts",
      slug: "hello",
      now,
    });
    const parsed = new URL(url);
    const valid = await verifyPreviewSignature({
      secret: SECRET,
      collection: "posts",
      slug: "other-slug",
      expiresAt: Number(parsed.searchParams.get("exp")),
      signature: parsed.searchParams.get("sig") ?? "",
      now,
    });
    expect(valid).toBe(false);
  });

  it("秘密鍵が違えば false", async () => {
    const now = 1_000_000;
    const url = await createPreviewUrl("https://x/preview/posts/hello", {
      secret: SECRET,
      collection: "posts",
      slug: "hello",
      now,
    });
    const parsed = new URL(url);
    const valid = await verifyPreviewSignature({
      secret: "wrong-secret",
      collection: "posts",
      slug: "hello",
      expiresAt: Number(parsed.searchParams.get("exp")),
      signature: parsed.searchParams.get("sig") ?? "",
      now,
    });
    expect(valid).toBe(false);
  });
});
