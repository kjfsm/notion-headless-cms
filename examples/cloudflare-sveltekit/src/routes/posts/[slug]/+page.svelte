<script lang="ts">
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<article>
	<h1>{data.item.slug}</h1>
	{#if data.item.publishedAt}
		<time>{data.item.publishedAt}</time>
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.html}
</article>
