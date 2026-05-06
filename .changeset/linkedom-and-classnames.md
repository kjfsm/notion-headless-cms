---
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-embed": patch
"@notion-headless-cms/react-renderer": patch
---

OGP メタデータの抽出を自前正規表現から `linkedom` に置き換え、属性順や `name=`/`property=` のバリエーションを DOM API でまとめて扱うようにした。HTML エンティティのデコードも DOM 側に委譲。挙動互換。

`react-renderer` の各 block コンポーネントを `tailwind-merge` ベースの `cn()` で統一し、`BlockComponentProps.className` と `<NotionRenderer classNames={{ ... }} />` を新設。block.type ごとにルート要素のクラスを差し替えられるようになった（追加 API、後方互換）。
