import type { TransformStage } from "../pipeline/transform-stage.js";
import { isJsonRecord, mapBlocks, mapJsonObjects } from "./walk.js";

/** `createKatexTransform()` のオプション。 */
export interface KatexTransformOptions {
  /** KaTeX の `macros` オプション（`\RR` → `\mathbb{R}` 等）。 */
  readonly macros?: Readonly<Record<string, string>>;
  /**
   * 組版関数の注入（テスト・独自レンダラ用）。省略時は動的 `import("katex")` の
   * `renderToString`。`null` を返した数式は素通しになる。
   */
  readonly render?: (
    expression: string,
    displayMode: boolean,
  ) => Promise<string | null>;
}

function createDefaultRender(
  macros: Readonly<Record<string, string>> | undefined,
): (expression: string, displayMode: boolean) => Promise<string | null> {
  let katexPromise: Promise<
    ((expression: string, options: Record<string, unknown>) => string) | null
  > | null = null;

  async function load() {
    try {
      const katex = (await import("katex")).default;
      return katex.renderToString.bind(katex);
    } catch {
      // katex が optional peer として未インストールの環境では素通しにする。
      return null;
    }
  }

  return async (expression, displayMode) => {
    katexPromise ??= load();
    const renderToString = await katexPromise;
    if (!renderToString) return null;
    try {
      return renderToString(expression, {
        displayMode,
        throwOnError: false,
        ...(macros ? { macros: { ...macros } } : {}),
      });
    } catch {
      return null;
    }
  };
}

/**
 * 数式に KaTeX の SSR 結果を `__cachedHtml` として焼き込む TransformStage
 * （オプトイン層）。対象は 2 種類:
 *
 * - `equation` ブロック → `data.__cachedHtml`（`displayMode: true`）
 * - rich_text 内の inline equation item（`{ type: "equation" }`）→
 *   `equation.__cachedHtml`（`displayMode: false`）。caption・table_row の cells 等、
 *   `data` の深部に現れるものもすべて対象
 *
 * 描画には katex の CSS（`katex/dist/katex.min.css`）の読み込みが別途必要。
 * katex は optional peerDependency で、未インストール・組版失敗時は素通しする
 * （描画側のクライアント遅延 KaTeX / 素テキストのフォールバックに任せる）。
 *
 * @example
 * ```ts
 * createCMS({ ..., transforms: [createKatexTransform()] });
 * ```
 */
export function createKatexTransform(
  opts?: KatexTransformOptions,
): TransformStage {
  const render = opts?.render ?? createDefaultRender(opts?.macros);

  return {
    name: "katex",
    async transform(blocks) {
      return mapBlocks(blocks, async (block) => {
        let next = block;
        if (
          block.type === "equation" &&
          isJsonRecord(block.data) &&
          typeof block.data.expression === "string" &&
          typeof block.data.__cachedHtml !== "string"
        ) {
          const html = await render(block.data.expression, true);
          if (html) {
            next = { ...block, data: { ...block.data, __cachedHtml: html } };
          }
        }
        const data = await mapJsonObjects(next.data, async (obj) => {
          if (obj.type !== "equation") return null;
          const equation = obj.equation;
          if (
            !isJsonRecord(equation) ||
            typeof equation.expression !== "string" ||
            typeof equation.__cachedHtml === "string"
          ) {
            return null;
          }
          const html = await render(equation.expression, false);
          if (!html) return null;
          return { ...obj, equation: { ...equation, __cachedHtml: html } };
        });
        if (data !== next.data) next = { ...next, data };
        return next;
      });
    },
  };
}
