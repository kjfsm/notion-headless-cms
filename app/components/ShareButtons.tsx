type Props = {
	url: string;
	title: string;
};

export function ShareButtons({ url, title }: Props) {
	const u = encodeURIComponent(url);
	const t = encodeURIComponent(title);

	return (
		<div className="mt-10 flex gap-3 text-sm">
			<a
				href={`https://twitter.com/intent/tweet?text=${t}&url=${u}`}
				target="_blank"
				rel="noreferrer"
				className="rounded border border-gray-200 px-3 py-1.5 text-gray-600 hover:border-purple-400 hover:text-purple-600"
			>
				X
			</a>
			<a
				href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}
				target="_blank"
				rel="noreferrer"
				className="rounded border border-gray-200 px-3 py-1.5 text-gray-600 hover:border-purple-400 hover:text-purple-600"
			>
				Facebook
			</a>
			<a
				href={`https://social-plugins.line.me/lineit/share?url=${u}`}
				target="_blank"
				rel="noreferrer"
				className="rounded border border-gray-200 px-3 py-1.5 text-gray-600 hover:border-purple-400 hover:text-purple-600"
			>
				LINE
			</a>
		</div>
	);
}
