import type { TransformStage } from "../pipeline/transform-stage.js";
import type { JsonValue } from "../types/json-value.js";
import { isJsonRecord, mapBlocks } from "./walk.js";

/** `createShikiTransform()` のオプション。 */
export interface ShikiTransformOptions {
  /**
   * ライト/ダーク両対応のデュアルテーマ。トークン span に `--shiki-light` /
   * `--shiki-dark` の CSS 変数が inline 出力され、`theme.css` の `.dark` 切替が効く。
   * 既定: `{ light: "github-light", dark: "github-dark" }`。
   */
  readonly themes?: { readonly light: string; readonly dark: string };
  /**
   * ハイライト関数の注入（テスト・独自ハイライタ用）。省略時は動的
   * `import("shiki")` の highlighter（JS regex エンジン）を使う。
   * `null` を返したブロックは素通しになる。
   */
  readonly highlight?: (code: string, lang: string) => Promise<string | null>;
  /**
   * これを超える文字数の code ブロックはハイライトせずスキップする
   * （同期エンジンの CPU 予算対策）。既定: 20000。
   */
  readonly maxCodeLength?: number;
}

const DEFAULT_THEMES = { light: "github-light", dark: "github-dark" } as const;
const DEFAULT_MAX_CODE_LENGTH = 20000;

/** Notion の言語名を shiki が解釈できる名前へ正規化する。 */
export function normalizeShikiLang(lang: string): string {
  const l = lang.trim().toLowerCase();
  if (l === "" || l === "plain text" || l === "plain_text" || l === "plaintext") return "text";
  return l;
}

function plainText(richText: JsonValue | undefined): string {
  if (!Array.isArray(richText)) return "";
  return richText
    .map((item) =>
      isJsonRecord(item) && typeof item.plain_text === "string" ? item.plain_text : "",
    )
    .join("");
}

type Highlighter = {
  codeToHtml(code: string, options: Record<string, unknown>): string;
  loadLanguage(lang: string): Promise<void>;
  getLoadedLanguages(): string[];
};

/**
 * `react-renderer` の `theme.css` が期待する
 * `pre > code[data-line-numbers] > span[data-line]` 構造（rehype-pretty-code 互換）に
 * shiki 出力を揃える transformer。pre の inline 背景はカード側で制御するため除去する。
 */
function structureTransformer() {
  return {
    name: "nhc:pretty-code-structure",
    pre(node: { properties: Record<string, unknown> }) {
      node.properties.style = undefined;
    },
    code(node: { properties: Record<string, unknown> }) {
      node.properties["data-line-numbers"] = "";
    },
    line(node: { properties: Record<string, unknown> }) {
      node.properties["data-line"] = "";
    },
  };
}

function createDefaultHighlight(themes: {
  readonly light: string;
  readonly dark: string;
}): (code: string, lang: string) => Promise<string | null> {
  // DO がホットな間は highlighter を再利用する（言語 grammar のロードを 1 回に抑える）。
  let highlighterPromise: Promise<Highlighter | null> | null = null;

  async function load(): Promise<Highlighter | null> {
    try {
      const shiki = await import("shiki");
      const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
      // oniguruma(wasm) ではなく JS regex エンジンを使う。Workers での wasm ロードを
      // 避けつつ CPU コストも抑えられる（precompiled grammar 対応）。
      const highlighter = await shiki.createHighlighter({
        themes: [themes.light, themes.dark],
        langs: [],
        engine: createJavaScriptRegexEngine({ forgiving: true }),
      });
      return highlighter as unknown as Highlighter;
    } catch {
      // shiki が optional peer として未インストールの環境では素通しにする。
      return null;
    }
  }

  return async (code, lang) => {
    highlighterPromise ??= load();
    const highlighter = await highlighterPromise;
    if (!highlighter) return null;
    let resolvedLang = lang;
    if (!highlighter.getLoadedLanguages().includes(resolvedLang)) {
      try {
        await highlighter.loadLanguage(resolvedLang);
      } catch {
        resolvedLang = "text";
      }
    }
    try {
      return highlighter.codeToHtml(code, {
        lang: resolvedLang,
        themes,
        defaultColor: false,
        transformers: [structureTransformer()],
      });
    } catch {
      return null;
    }
  };
}

/**
 * code ブロックに shiki のシンタックスハイライト結果を `data.__cachedHtml` として
 * 焼き込む TransformStage（オプトイン層）。`react-renderer` の `Code` と v3 HTML
 * レンダラは `__cachedHtml` があればそれを優先描画する。
 *
 * - shiki は optional peerDependency。未インストール・ロード失敗時は blocks を素通しする
 * - ハイライトに失敗したブロックも素通し（描画側の `<pre>` フォールバックに任せる）
 * - 同期時（Worker/DO 内）に実行されるため、`maxCodeLength` で CPU 予算を防衛する
 *
 * @example
 * ```ts
 * createCMS({ ..., transforms: [createShikiTransform()] });
 * ```
 */
export function createShikiTransform(opts?: ShikiTransformOptions): TransformStage {
  const themes = opts?.themes ?? DEFAULT_THEMES;
  const maxCodeLength = opts?.maxCodeLength ?? DEFAULT_MAX_CODE_LENGTH;
  const highlight = opts?.highlight ?? createDefaultHighlight(themes);

  return {
    name: "shiki",
    async transform(blocks) {
      return mapBlocks(blocks, async (block) => {
        if (block.type !== "code" || !isJsonRecord(block.data)) return block;
        if (typeof block.data.__cachedHtml === "string") return block;
        const source = plainText(block.data.rich_text);
        if (source.length === 0 || source.length > maxCodeLength) return block;
        const lang = normalizeShikiLang(
          typeof block.data.language === "string" ? block.data.language : "",
        );
        const html = await highlight(source, lang);
        if (!html) return block;
        return { ...block, data: { ...block.data, __cachedHtml: html } };
      });
    },
  };
}
