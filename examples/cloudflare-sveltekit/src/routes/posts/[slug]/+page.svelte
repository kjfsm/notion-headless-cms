<script lang="ts">
	import type { PageData } from "./$types";
	let { data }: { data: PageData } = $props();
</script>

<article>
	<h1>{data.item.title}</h1>
	{#if data.item.publishedAt}
		<time>{data.item.publishedAt}</time>
	{/if}
	{#if data.item.tags.length > 0}
		<ul>
			{#each data.item.tags as tag (tag)}
				<li>{tag}</li>
			{/each}
		</ul>
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.html}
</article>
