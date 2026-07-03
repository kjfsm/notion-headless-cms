import { hmacSha256Hex, timingSafeEqual } from "../http/webhook.js";

export interface PreviewTokenParams {
  readonly secret: string;
  readonly collection: string;
  readonly slug: string;
  readonly expiresAt: number;
}

async function computeSignature(params: PreviewTokenParams): Promise<string> {
  const message = `${params.collection}:${params.slug}:${params.expiresAt}`;
  return hmacSha256Hex(params.secret, message);
}

export interface CreatePreviewUrlOptions {
  readonly secret: string;
  readonly collection: string;
  readonly slug: string;
  /** 有効期限(ms)。既定 24 時間。 */
  readonly ttlMs?: number;
  readonly now?: number;
}

/** 署名付きプレビュー URL を発行する(CLI or API から呼ぶヘルパー)。 */
export async function createPreviewUrl(
  baseUrl: string,
  opts: CreatePreviewUrlOptions,
): Promise<string> {
  const now = opts.now ?? Date.now();
  const expiresAt = now + (opts.ttlMs ?? 24 * 60 * 60 * 1000);
  const signature = await computeSignature({
    secret: opts.secret,
    collection: opts.collection,
    slug: opts.slug,
    expiresAt,
  });
  const url = new URL(baseUrl);
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return url.toString();
}

export interface VerifyPreviewSignatureOptions {
  readonly secret: string;
  readonly collection: string;
  readonly slug: string;
  readonly expiresAt: number;
  readonly signature: string;
  readonly now?: number;
}

/** 署名と有効期限を検証する。期限切れ・署名不一致はいずれも false。 */
export async function verifyPreviewSignature(
  opts: VerifyPreviewSignatureOptions,
): Promise<boolean> {
  const now = opts.now ?? Date.now();
  if (now > opts.expiresAt) return false;
  const expected = await computeSignature({
    secret: opts.secret,
    collection: opts.collection,
    slug: opts.slug,
    expiresAt: opts.expiresAt,
  });
  return timingSafeEqual(opts.signature, expected);
}
