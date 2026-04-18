---
"@notion-headless-cms/core": patch
"@notion-headless-cms/adapter-cloudflare": patch
---

env をコンストラクタ（CMSConfig）で受け取るよう変更し、各メソッドの env 引数を削除。
createCloudflareCMS は env を自動注入するため、呼び出し側での変更は不要。
