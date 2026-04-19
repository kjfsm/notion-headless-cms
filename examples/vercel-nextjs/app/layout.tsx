import type { ReactNode } from "react";

export const metadata = {
	title: "Notion Blog",
	description: "notion-headless-cms + Next.js App Router の例",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ja">
			<body>{children}</body>
		</html>
	);
}
