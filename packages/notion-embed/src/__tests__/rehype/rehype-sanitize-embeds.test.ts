import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { defineEmbedProvider } from "../../providers/index";
import { embedRehypePlugins } from "../../rehype/rehype-sanitize-embeds";

/** embedRehypePlugins の最後の要素が rehype-sanitize タプル */
function getSanitizeEntry(
  plugins: Awaited<ReturnType<typeof embedRehypePlugins>>,
) {
  return plugins.at(-1) as [unknown, unknown];
}

describe("embedRehypePlugins", () => {
  it("3 要素のプラグインリストを返す (rehype-raw / toggle-classes / rehype-sanitize)", async () => {
    const plugins = await embedRehypePlugins();
    expect(plugins).toHaveLength(3);
  });

  it("provider の sanitizeSchema が iframe を許可する", async () => {
    const steamProvider = defineEmbedProvider({
      id: "steam",
      match: (url) => url.includes("steampowered.com"),
      render: () => ({ kind: "html", html: "" }),
      sanitizeSchema: {
        tagNames: ["iframe"],
        attributes: {
          iframe: ["src", "width", "height", "frameBorder", "loading"],
        },
      },
    });
    const plugins = await embedRehypePlugins({ providers: [steamProvider] });
    const sanitize = getSanitizeEntry(plugins);
    // rehype-sanitize は [plugin, schema] の形式
    expect(Array.isArray(sanitize)).toBe(true);
    const schema = sanitize[1] as { tagNames?: string[] };
    expect(schema.tagNames).toContain("iframe");
  });

  it("スキーマに script が含まれない (strip されている)", async () => {
    const plugins = await embedRehypePlugins();
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { strip?: string[] };
    expect(schema.strip).toContain("script");
  });

  it("extendSchema で追加属性を許可できる", async () => {
    const plugins = await embedRehypePlugins({
      extendSchema: {
        attributes: { a: ["rel", "itemprop"] },
      },
    });
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { attributes?: Record<string, unknown> };
    expect(schema.attributes?.a).toContain("itemprop");
  });

  it("providers が空でも正常に動作する", async () => {
    const plugins = await embedRehypePlugins({ providers: [] });
    expect(plugins).toHaveLength(3);
  });
});

describe("schema 深いマージ", () => {
  it("provider の protocols がマージされる", async () => {
    const provider = defineEmbedProvider({
      id: "p",
      match: () => true,
      render: () => ({ kind: "html", html: "" }),
      sanitizeSchema: {
        protocols: { src: ["data"] },
      },
    });
    const plugins = await embedRehypePlugins({ providers: [provider] });
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { protocols?: Record<string, string[]> };
    expect(schema.protocols?.src).toContain("data");
    // base にあった https/http も残っている
    expect(schema.protocols?.src).toContain("https");
  });

  it("base に存在しない protocols 属性も追加できる", async () => {
    const provider = defineEmbedProvider({
      id: "p",
      match: () => true,
      render: () => ({ kind: "html", html: "" }),
      sanitizeSchema: {
        protocols: { poster: ["https"] },
      },
    });
    const plugins = await embedRehypePlugins({ providers: [provider] });
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { protocols?: Record<string, string[]> };
    expect(schema.protocols?.poster).toContain("https");
  });

  it("provider の strip がマージされる", async () => {
    const provider = defineEmbedProvider({
      id: "p",
      match: () => true,
      render: () => ({ kind: "html", html: "" }),
      sanitizeSchema: { strip: ["custom-tag"] },
    });
    const plugins = await embedRehypePlugins({ providers: [provider] });
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { strip?: string[] };
    expect(schema.strip).toContain("custom-tag");
    expect(schema.strip).toContain("script");
  });

  it("base に存在しない attributes タグも追加できる", async () => {
    const provider = defineEmbedProvider({
      id: "p",
      match: () => true,
      render: () => ({ kind: "html", html: "" }),
      sanitizeSchema: {
        attributes: { article: ["data-id"] },
      },
    });
    const plugins = await embedRehypePlugins({ providers: [provider] });
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { attributes?: Record<string, unknown> };
    expect(schema.attributes?.article).toContain("data-id");
  });
});

describe("notionEmbed 基本スキーマ", () => {
  it("nhc-bookmark に必要なタグを含む (a, div, p, img)", async () => {
    const plugins = await embedRehypePlugins();
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { tagNames?: string[] };
    expect(schema.tagNames).toContain("a");
    expect(schema.tagNames).toContain("div");
    expect(schema.tagNames).toContain("p");
    expect(schema.tagNames).toContain("img");
  });

  it("details / summary (toggle) が許可されている", async () => {
    const plugins = await embedRehypePlugins();
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as { tagNames?: string[] };
    expect(schema.tagNames).toContain("details");
    expect(schema.tagNames).toContain("summary");
  });

  it("iframe が基本スキーマに含まれる (PDF・汎用 embed 用)", async () => {
    const plugins = await embedRehypePlugins();
    const sanitize = getSanitizeEntry(plugins);
    const schema = sanitize[1] as {
      tagNames?: string[];
      attributes?: Record<string, unknown>;
    };
    expect(schema.tagNames).toContain("iframe");
    expect(schema.attributes?.iframe).toContain("src");
    expect(schema.attributes?.iframe).toContain("allowFullScreen");
  });
});

// 実際の HTML パイプラインを通じて rehype-raw + rehype-sanitize の挙動を検証
async function processRawHtml(html: string): Promise<string> {
  const plugins = await embedRehypePlugins();
  // unified の use() に PluggableList を直接渡す
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processor = (unified() as any)
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(plugins)
    .use(rehypeStringify);
  const result = await processor.process(html);
  return String(result);
}

describe("HTML パイプライン通過テスト", () => {
  it("<code class='nhc-inline-code'> のクラスが sanitize 後に保持される", async () => {
    const html = '<code class="nhc-inline-code">コード</code>';
    const result = await processRawHtml(html);
    expect(result).toContain('class="nhc-inline-code"');
  });

  it("<a href='#'> が sanitize 後に保持される", async () => {
    const html = '<a href="#">ページリンク</a>';
    const result = await processRawHtml(html);
    expect(result).toContain('href="#"');
  });

  it("<details><summary> が sanitize 後に保持される", async () => {
    const html = "<details><summary>タイトル</summary><p>内容</p></details>";
    const result = await processRawHtml(html);
    expect(result).toContain("<details");
    expect(result).toContain("<summary");
    expect(result).toContain("タイトル");
  });

  it("rehypeAddToggleClasses が <details> に nhc-toggle クラスを付与する", async () => {
    const html = "<details><summary>タイトル</summary></details>";
    const result = await processRawHtml(html);
    expect(result).toContain("nhc-toggle");
    expect(result).toContain("nhc-toggle__summary");
  });
});
