/**
 * Node ランタイム専用のエントリ(`node:fs` に依存する)。
 * 汎用の `.` エントリからは静的 import しない — Workers 等 `node:fs` の無い
 * ランタイムへバンドルされないようにするため。
 */
export { fileBlobStore, fileIndexStore } from "./store/node-file.js";
