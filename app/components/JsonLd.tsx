type Props = {
	data: object;
};

export function JsonLd({ data }: Props) {
	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be embedded as raw JSON script content
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data),
			}}
		/>
	);
}
