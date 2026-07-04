// このパッケージは vite に依存しないため、Code/Equation/InlineEquation が参照する
// import.meta.env.SSR のみを最小限でアンビエント宣言する。
interface ImportMetaEnv {
  readonly SSR: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
