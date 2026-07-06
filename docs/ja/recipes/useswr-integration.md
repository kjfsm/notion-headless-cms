---
title: 表示更新（クライアント側再検証）
description: NotionRevalidator で画面を静かに最新化する
category: レシピ
order: 4
---

# 表示更新（クライアント側再検証）

> 旧バージョンの本レシピは「サーバー側 API ルートを立てて `useSWR`（npm パッケージ）と
> 連携する」内容だった。v3 の `@notion-headless-cms/cms` は `find()`/`list()` が KV/R2 の
> 完全マテリアライズドレプリカを読むだけで、SSR/RSC の loader を再実行するだけで最新データが
> 手に入る。そのため「クライアント側で別のキャッシュ層を持つ」動機自体が薄く、
> 現在の「画面を最新化する」唯一の推奨手段は `@notion-headless-cms/react-renderer` の
> `NotionRevalidator` / `useNotionRevalidate` になる。本レシピはその使い方に一本化する。

## `NotionRevalidator` とは

Notion を更新したとき、画面を**静かに切り替える**ための最小コンポーネント。内部で
「現在のルートを再評価する」関数を呼ぶだけで、専用 API ルートも別 fetch も発生しない。

- **React Router (Framework mode)**: `@notion-headless-cms/react-renderer/router` から import。
  `useRevalidator().revalidate()` を呼び、loader を再実行する。
- **Next.js App Router**: `@notion-headless-cms/react-renderer/next` から import。
  `useRouter().refresh()` を呼び、RSC ストリームを差分で受け取る。

どちらも同じ props 形状（`UseNotionRevalidateOptions`）を持ち、既定トリガーは
`["mount", "visibility"]`（マウント時 + タブ再フォーカス時）。

```tsx
// React Router
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";
<NotionRevalidator />

// Next.js App Router
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
<NotionRevalidator />
```

レンダーせずフック単体で使いたい場合は `useNotionRevalidate()` を呼ぶ（`NotionRevalidator` は
これを内部で呼ぶだけの薄いラッパー）。

```tsx
import { useNotionRevalidate } from "@notion-headless-cms/react-renderer/router";

export default function Post({ loaderData }: Route.ComponentProps) {
  useNotionRevalidate({ on: ["mount", "visibility"] });
  // ...
}
```

## トリガーをカスタマイズする

```tsx
<NotionRevalidator on="mount" />                    // マウント時のみ
<NotionRevalidator on="visibility" />               // 再フォーカス時のみ
<NotionRevalidator on={["mount", "visibility"]} />   // 既定と同じ（省略時のデフォルト）
```

## リアルタイム push と組み合わせる（Durable Object 構成）

Cloudflare の Durable Object（`RealtimeHubDO`）で同期完了を WebSocket push している場合、
`realtime` オプションを渡すと push 主経路に切り替わり、ポーリング・チェックは行わなくなる。

```tsx
<NotionRevalidator realtime={{ collection: "posts", item: { slug: post.slug } }} />
```

構成手順は [`cloudflare-workers.md`](./cloudflare-workers.md) を参照。`realtime` を指定しない
場合は、mount / visibility のタイミングで単に loader を再実行するだけになる
（Notion との突合は同期経路 — webhook や `cms.sync.kick()` — が別途担う）。

## それでも独立したクライアント側フェッチが必要な場合

サイドバーの「最近の記事」ウィジェットのように、**ページの loader とは無関係な間隔で
自分だけ再取得したい**ケースはまれにある。この場合はページの本流とは別に、
`cms.posts.list()` を返す小さな JSON エンドポイントを自分で用意し（
[`cloudflare-workers.md`](./cloudflare-workers.md) の Hono JSON API 例を参照）、
クライアント側で任意のデータフェッチライブラリ（`swr` パッケージなど）を使えばよい。
これは `@notion-headless-cms/cms` 固有の機能ではなく、一般的なクライアントフェッチの
パターンをそのまま適用しているだけの点に注意する（`@notion-headless-cms/react-renderer` は
内部的に `swr` パッケージの `useSWRSubscription` を realtime push の購読に使っているが、
これは実装詳細でありユーザーが直接呼ぶ API ではない）。

## 関連

- [React Router レシピ](./react-router.md)
- [Next.js App Router レシピ](./nextjs-app-router.md)
- [Cloudflare Workers レシピ](./cloudflare-workers.md)
- [CMS メソッド一覧](../api/cms-methods.md)
