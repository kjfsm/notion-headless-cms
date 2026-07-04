/** HMAC-SHA256 を hex で返す(v2 `packages/core/src/handler.ts` を移植)。 */
export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** タイミング攻撃を避ける定数時間文字列比較。 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Notion 公式 webhook の `X-Notion-Signature` を検証する。 */
export async function verifyNotionSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const expected = `sha256=${await hmacSha256Hex(secret, rawBody)}`;
  return timingSafeEqual(signatureHeader ?? "", expected);
}
