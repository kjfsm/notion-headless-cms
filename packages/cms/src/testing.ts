/**
 * `vitest` に依存するテストユーティリティ専用のエントリ。
 * 汎用の `.` エントリからは静的 import しない(vitest を実行時バンドルに含めないため)。
 */
export type { BlobStoreContractOptions, IndexStoreContractOptions } from "./store/contract.js";
export { runBlobStoreContract, runIndexStoreContract } from "./store/contract.js";
