import { Link } from "react-router";

export function meta() {
	return [
		{ title: "Euphoric" },
		{ name: "description", content: "Euphoricのオフィシャルサイト" },
	];
}

export default function Home() {
	return (
		<div className="min-h-screen">
			{/* Hero */}
			<section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 text-center">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#f3e8ff_0%,_#fff_60%)]" />
				<div className="relative z-10 space-y-8">
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-500">
						オフィシャルサイト
					</p>
					<h1 className="text-[clamp(4rem,15vw,12rem)] font-black leading-none tracking-tighter text-gray-900">
						EUPHORIC
					</h1>
					<p className="mx-auto max-w-xl text-lg text-gray-500">
						音楽で動かす。ライブで記憶に刻む。
					</p>
					<div className="flex flex-wrap justify-center gap-4 pt-4">
						<a
							href="#shows"
							className="rounded-full bg-purple-600 px-8 py-3 font-semibold text-white transition hover:bg-purple-500"
						>
							ライブ情報
						</a>
						<Link
							to="/blog"
							className="rounded-full border border-gray-300 px-8 py-3 font-semibold text-gray-700 transition hover:border-purple-400 hover:text-purple-600"
						>
							ニュース・ブログ
						</Link>
					</div>
				</div>
				<div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-300">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<title>下にスクロール</title>
						<path d="M12 5v14M5 12l7 7 7-7" />
					</svg>
				</div>
			</section>

			{/* Shows */}
			<section id="shows" className="bg-gray-50 px-6 py-24">
				<div className="mx-auto max-w-3xl">
					<h2 className="mb-12 text-3xl font-bold tracking-tight text-gray-900">
						ライブ情報
					</h2>
					<div className="divide-y divide-gray-200">
						{[
							{
								date: "2026年5月24日",
								venue: "Zepp Shinjuku",
								city: "東京",
							},
							{
								date: "2026年6月7日",
								venue: "なんばHatch",
								city: "大阪",
							},
							{
								date: "2026年6月21日",
								venue: "Zepp Fukuoka",
								city: "福岡",
							},
						].map((show) => (
							<div
								key={show.date}
								className="flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="flex gap-6">
									<span className="w-36 shrink-0 font-mono text-sm text-purple-500">
										{show.date}
									</span>
									<div>
										<p className="font-semibold text-gray-900">{show.venue}</p>
										<p className="text-sm text-gray-500">{show.city}</p>
									</div>
								</div>
								<button
									type="button"
									className="rounded-full border border-purple-500 px-5 py-1.5 text-sm font-medium text-purple-600 transition hover:bg-purple-600 hover:text-white"
								>
									チケット
								</button>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Blog CTA */}
			<section className="bg-white px-6 py-24">
				<div className="mx-auto max-w-3xl text-center">
					<h2 className="mb-6 text-3xl font-bold tracking-tight text-gray-900">
						最新情報をチェック
					</h2>
					<p className="mb-8 text-gray-500">
						ニュース、ライブのレポート、制作の裏側まで。
					</p>
					<Link
						to="/blog"
						className="inline-block rounded-full bg-gray-900 px-8 py-3 font-semibold text-white transition hover:bg-gray-700"
					>
						ブログを読む
					</Link>
				</div>
			</section>
		</div>
	);
}
