---
"@notion-headless-cms/react-renderer": patch
---

react-renderer: 単一 Context 化で prop drilling を解消する（#217）

- `src/context.tsx` を追加し `NotionContext` / `useNotionContext` を公開
- `NotionRenderer` が `NotionContext.Provider` を貼り、設定を Context に格納
- `NotionBlocks` コンポーネントを新設し `renderBlocks` 関数を置き換え（公開 API）
- `BlockSwitch` が Context から `components` / `classNames` を取得し、props から除去
- `BlockComponentProps.renderChildren` を廃止。各 Block 実装は `<NotionBlocks>` を直接呼ぶ
- `ComponentOverrides` の各スロットを block 固有の narrow 型に変更（`as` キャスト不要に）
- `useNotionContext` / `NotionBlocks` / `HeadingBlockObjectResponse` を index.ts から export
