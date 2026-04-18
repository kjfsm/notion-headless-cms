# @kjfsm/notion-headless-cms-fetcher

Notion API クライアントラッパー。データベースのクエリとページブロックの取得を担当する。

## インストール

```bash
npm install @kjfsm/notion-headless-cms-fetcher
```

通常は [`@kjfsm/notion-headless-cms-core`](../core) 経由で利用される。  
低レベル API を直接使いたい場合にのみインストールする。

## 使い方

```typescript
import {
  createNotionClient,
  fetchDatabase,
  fetchBlocks,
} from "@kjfsm/notion-headless-cms-fetcher";

const client = createNotionClient("notion_api_token");

// データベース一覧取得
const pages = await fetchDatabase(client, "database_id");

// ページのブロック取得
const blocks = await fetchBlocks(client, pages[0].id);
```

## API

| エクスポート | 説明 |
|---|---|
| `createNotionClient(token)` | Notion クライアントを生成する |
| `fetchDatabase(client, databaseId)` | データベースの全ページを取得する |
| `fetchBlocks(client, pageId)` | ページの全ブロックを再帰取得する |

## 関連パッケージ

- [`@kjfsm/notion-headless-cms-core`](../core) — CMS エンジン（このパッケージを内部で使用）
- [`@kjfsm/notion-headless-cms-transformer`](../transformer) — 取得したブロックを Markdown に変換
