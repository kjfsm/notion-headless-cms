<script lang="ts">
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<main>
	<h1>記事一覧</h1>
	<ul>
		{#each data.items as post (post.slug)}
			<li>
				<a href="/posts/{post.slug}">
					<strong>{post.title || post.slug}</strong>
					{#if post.publishedAt}
						<time>{post.publishedAt}</time>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</main>
