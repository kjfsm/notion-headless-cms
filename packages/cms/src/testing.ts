/**
 * `vitest` に依存するテストユーティリティ専用のエントリ。
 * 汎用の `.` エントリからは静的 import しない(vitest を実行時バンドルに含めないため)。
 */
export type { BlobStoreContractOptions, DocStoreContractOptions } from "./store/contract.js";
export { runBlobStoreContract, runDocStoreContract } from "./store/contract.js";
