import {
	isRouteErrorResponse,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

// ホームページでは透明、それ以外ではすりガラス背景で表示するナビゲーションバー。
function Nav() {
	const location = useLocation();
	const isHome = location.pathname === "/";

	return (
		<header
			className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 ${
				isHome
					? "bg-transparent"
					: "border-b border-gray-100 bg-white/90 backdrop-blur"
			}`}
		>
			<Link
				to="/"
				className="text-lg font-black tracking-tighter text-gray-900 transition hover:text-purple-600"
			>
				EUPHORIC
			</Link>
			<nav className="flex items-center gap-6 text-sm font-medium">
				<Link
					to="/#shows"
					className="text-gray-500 transition hover:text-gray-900"
				>
					ライブ
				</Link>
				<Link
					to="/blog"
					className="text-gray-500 transition hover:text-gray-900"
				>
					ブログ
				</Link>
			</nav>
		</header>
	);
}

export default function App() {
	return (
		<>
			<Nav />
			<Outlet />
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "ページが見つかりませんでした。"
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
