// react-renderer のサーバー側ユーティリティ。"use client" を含めないため、
// クライアントコンポーネント用のエントリ (`./index.ts`) とは別ファイルにする。

export type { CacheImageFn } from "./resolve-image-urls";
export { resolveBlockImageUrls } from "./resolve-image-urls";
