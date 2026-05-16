import { Link } from "react-router";

export function meta() {
  return [{ title: "notion-headless-cms ドキュメント" }];
}

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center py-20 px-4">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        notion-headless-cms
      </h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
        Notion をヘッドレス CMS として使う TypeScript ライブラリ
      </p>
      <Link
        to="/docs/installation"
        className="rounded-md bg-gray-900 px-6 py-2 text-white hover:bg-gray-700 transition-colors"
      >
        はじめる
      </Link>
    </main>
  );
}
