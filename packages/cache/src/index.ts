// メモリキャッシュ。core 同梱の実装をそのまま re-export する。
// (核となるアダプタ実装は core 内にあるが、ユーザー向けの公開窓口は cache パッケージに統一する)
export type { MemoryCacheOptions } from "@notion-headless-cms/core";
export { memoryCache } from "@notion-headless-cms/core";
