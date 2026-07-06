import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

/**
 * Express (Node の `http.IncomingMessage`/`ServerResponse`) は Fetch API の
 * `Request`/`Response` を話さないため、`cms.fetch()`（Web 標準ハンドラ）に
 * 委譲するには変換が要る。Hono 等 Fetch API ベースのフレームワークには不要な層。
 */
export function toWebRequest(req: ExpressRequest): Request {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
    // Node の fetch 実装は body がストリームの場合 duplex: "half" を要求する。
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);
}

export async function sendWebResponse(res: ExpressResponse, webResponse: Response): Promise<void> {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!webResponse.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(webResponse.body as unknown as NodeWebReadableStream);
  await new Promise<void>((resolve, reject) => {
    nodeStream.on("error", reject);
    res.on("error", reject);
    res.on("finish", resolve);
    nodeStream.pipe(res);
  });
}
