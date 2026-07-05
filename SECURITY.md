# セキュリティポリシー

## サポート対象バージョン

`@notion-headless-cms/*` は 0.x/3.x 系の開発中ライブラリで、公式な LTS はありません。
脆弱性が確認された場合は各パッケージの最新バージョンに対して修正版を patch リリースします。
古いバージョンへのバックポートは行わないため、常に最新版へのアップデートを推奨します。

## 脆弱性の報告方法

**セキュリティ上の懸念事項を公開 issue や公開 Discussion に書かないでください。**
悪用可能な脆弱性が公開されると、修正が行き渡る前に攻撃者に悪用される可能性があります。

代わりに、GitHub の **Private vulnerability reporting**（プライベートな脆弱性報告）を使用してください:

1. このリポジトリの [Security] タブを開く
2. **Report a vulnerability** をクリック
3. 再現手順・影響範囲・該当パッケージ/バージョンを可能な限り具体的に記載する

参考: https://docs.github.com/ja/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability

GitHub のプライベート報告が使えない場合は、リポジトリオーナー（[@kjfsm](https://github.com/kjfsm)）の
プロフィールに記載の連絡先へ直接連絡してください。

## 対応の目安

個人メンテナンスのプロジェクトのため、対応時間の SLA は保証できませんが、
受領確認・トリアージには可能な限り速やかに対応します。修正版がリリースされ次第、
報告者に連絡した上で GitHub Security Advisory を公開します。

## スコープ

対象:

- `packages/*` 配下で公開されている `@notion-headless-cms/*` パッケージ本体のコード
- 同期・ストレージ・HTTP 配信（webhook 署名検証・OGP プロキシの SSRF・realtime push の認証等）に関する脆弱性

対象外:

- `examples/*` / `apps/docs`（デモ用途、本番運用を想定していません）
- 利用側アプリケーションの設定・実装に起因する問題（例: `webhookSecret` を公開リポジトリにコミットした等）
- 依存パッケージ（`@notionhq/client` 等）自体の脆弱性 — 各プロジェクトへ直接報告してください
