---
"@notion-headless-cms/react-renderer": patch
---

`Equation` ブロックのデフォルト実装をスタブ化し、KaTeX 対応版を `@notion-headless-cms/react-renderer/equation` サブパスへ分離した。`katex` を `dependencies` から `peerDependencies`（optional）に降格したため、数式を使わないユースケースではメインバンドルから KaTeX が完全に除外される（gzip 約 75 KB 削減）。

**移行手順** — 数式を整形表示する場合のみ:

```bash
pnpm add katex
```

```tsx
import dynamic from "next/dynamic";

const Equation = dynamic(() =>
  import("@notion-headless-cms/react-renderer/equation").then((m) => m.Equation),
);

<NotionRenderer blocks={blocks} components={{ Equation }} />;
```

数式を使わない場合は何もする必要はない（既定の `Equation` は式を `<pre>` で素のまま表示する）。
