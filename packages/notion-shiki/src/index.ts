import type {
  BlockEnricher,
  NotionBlockTreeNode,
} from "@notion-headless-cms/notion-orm";
import { codeToHtml } from "shiki";

/** shiki がサポートする言語名（Notion の `code.language` と同名になるものを列挙） */
const SUPPORTED_LANGS = new Set([
  "abap",
  "arduino",
  "bash",
  "clike",
  "c",
  "cpp",
  "css",
  "diff",
  "django",
  "docker",
  "elixir",
  "elm",
  "erlang",
  "flow",
  "fortran",
  "fsharp",
  "gherkin",
  "glsl",
  "go",
  "graphql",
  "groovy",
  "haskell",
  "html",
  "java",
  "javascript",
  "json",
  "julia",
  "kotlin",
  "latex",
  "less",
  "lisp",
  "livescript",
  "lua",
  "makefile",
  "markdown",
  "markup",
  "matlab",
  "mermaid",
  "nix",
  "objective-c",
  "ocaml",
  "pascal",
  "perl",
  "php",
  "plain text",
  "powershell",
  "prolog",
  "protobuf",
  "python",
  "r",
  "reason",
  "ruby",
  "rust",
  "sass",
  "scala",
  "scheme",
  "scss",
  "shell",
  "sql",
  "swift",
  "toml",
  "typescript",
  "tsx",
  "vb.net",
  "verilog",
  "vhdl",
  "visual basic",
  "webassembly",
  "xml",
  "yaml",
  "java/c/c++/c#",
]);

/** Notion の language 名を shiki の lang ID へマッピング */
const LANG_MAP: Record<string, string> = {
  "plain text": "text",
  "visual basic": "vb",
  "vb.net": "vb",
  "java/c/c++/c#": "java",
  tsx: "tsx",
  javascript: "js",
  typescript: "ts",
  shell: "sh",
};

function resolveShikiLang(notionLang: string): string {
  return LANG_MAP[notionLang] ?? notionLang;
}

/** `notionShiki()` のオプション。 */
export interface NotionShikiOptions {
  /** shiki テーマ。デフォルト: `"github-dark"` */
  theme?: string;
  /** shiki がサポートしない言語の場合のフォールバック言語。デフォルト: `"text"` */
  fallbackLang?: string;
}

/** code ブロックに `__cachedHtml` が付与された拡張型。 */
export type CodeBlockWithCachedHtml = {
  type: "code";
  code: {
    rich_text: Array<{ plain_text: string }>;
    language: string;
    __cachedHtml: string;
  };
};

/**
 * fetch 時に Notion の code ブロックを shiki で HTML 化し、
 * `block.code.__cachedHtml` に埋め込む `BlockEnricher` を返す。
 *
 * `react-renderer` の Code スタブは `__cachedHtml` があれば
 * `dangerouslySetInnerHTML` で描画するため、バンドルから shiki を除外できる。
 *
 * @example
 * ```ts
 * import { notionShiki } from "@notion-headless-cms/notion-shiki";
 * import { createNotionCollection } from "@notion-headless-cms/notion-orm";
 *
 * source: createNotionCollection({
 *   token: process.env.NOTION_TOKEN,
 *   dataSourceId: "...",
 *   enrichers: [notionShiki({ theme: "github-dark" })],
 * });
 * ```
 */
export function notionShiki(opts?: NotionShikiOptions): BlockEnricher {
  const theme = opts?.theme ?? "github-dark";
  const fallbackLang = opts?.fallbackLang ?? "text";

  return async (
    blocks: NotionBlockTreeNode[],
  ): Promise<NotionBlockTreeNode[]> => {
    await enrichBlocks(blocks, theme, fallbackLang);
    return blocks;
  };
}

type CodeLike = {
  rich_text: Array<{ plain_text: string }>;
  language: string;
  __cachedHtml?: string;
};

async function enrichBlocks(
  blocks: NotionBlockTreeNode[],
  theme: string,
  fallbackLang: string,
): Promise<void> {
  for (const block of blocks) {
    if (block.type === "code") {
      const code = block.code as CodeLike;
      const source = code.rich_text.map((rt) => rt.plain_text).join("");
      const notionLang = code.language ?? "";
      const lang = SUPPORTED_LANGS.has(notionLang)
        ? resolveShikiLang(notionLang)
        : fallbackLang;
      try {
        code.__cachedHtml = await codeToHtml(source, { lang, theme });
      } catch {
        // レンダリング失敗時は __cachedHtml を設定しない
      }
    }
    if (block.children?.length) {
      await enrichBlocks(block.children, theme, fallbackLang);
    }
  }
}
