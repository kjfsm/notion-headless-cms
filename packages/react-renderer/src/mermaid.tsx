// `@notion-headless-cms/react-renderer/mermaid` サブパス。
// mermaid は約 1 MB ある重い依存なので、利用側が明示的にこの subpath を import し
// `components={{ Code: MermaidCode }}` で差し込んだ場合だけバンドルに含まれる。
"use client";

import type { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useEffect, useId, useState } from "react";

import { Code as DefaultCode } from "./blocks/Code.js";
import type { BlockComponentProps } from "./types.js";

function plainText(rt: CodeBlockObjectResponse["code"]["rich_text"]): string {
  return rt.map((t) => t.plain_text).join("");
}

/**
 * Code ブロックを描画するコンポーネント。
 * `language === "mermaid"` のときだけ動的 import で `mermaid` を読んで SVG にし、
 * それ以外の言語は既定の `Code` に委譲する。
 *
 * 使い方:
 * ```tsx
 * import { MermaidCode } from "@notion-headless-cms/react-renderer/mermaid";
 * <NotionRenderer blocks={blocks} components={{ Code: MermaidCode }} />
 * ```
 */
export function MermaidCode(props: BlockComponentProps<CodeBlockObjectResponse>) {
  if (props.block.code.language === "mermaid") {
    return <MermaidSvg source={plainText(props.block.code.rich_text)} />;
  }
  return <DefaultCode {...props} />;
}

function MermaidSvg({ source }: { source: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        // securityLevel は "strict" にする。mermaid 内部で DOMPurify による
        // ラベル HTML のサニタイズとクリックハンドラの無効化が行われるため、source は
        // Notion 編集者が任意に書けるものの、下の dangerouslySetInnerHTML への
        // 格納型 XSS 経路が塞がれる。"loose" は HTML/クリックを許すため使わない。
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
        const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setSvg(svg);
      } catch {
        // mermaid 未インストール / render 失敗時は素のコード表示にフォールバック
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, reactId]);

  if (!svg) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
        <code>{source}</code>
      </pre>
    );
  }
  return (
    <div
      className="my-3 flex justify-center"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: securityLevel "strict" で mermaid が DOMPurify サニタイズ済みの SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
