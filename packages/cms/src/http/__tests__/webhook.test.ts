import { describe, expect, it } from "vitest";

import { hmacSha256Hex, timingSafeEqual, verifyNotionSignature } from "../webhook.js";

describe("timingSafeEqual", () => {
  it("同じ文字列は true", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });
  it("違う文字列は false", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });
  it("長さが違えば false", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("verifyNotionSignature", () => {
  it("正しい署名は true", async () => {
    const secret = "s3cr3t";
    const body = '{"hello":"world"}';
    const expected = `sha256=${await hmacSha256Hex(secret, body)}`;
    expect(await verifyNotionSignature(secret, body, expected)).toBe(true);
  });

  it("不正な署名は false", async () => {
    expect(await verifyNotionSignature("s3cr3t", "body", "sha256=bogus")).toBe(false);
  });

  it("署名ヘッダ無しは false", async () => {
    expect(await verifyNotionSignature("s3cr3t", "body", null)).toBe(false);
  });
});
