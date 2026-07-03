import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";
import { Hono } from "hono";
import { html, raw } from "hono/html";
import { cms } from "./lib/cms.js";

export const app = new Hono();

// --- JSON API ---

app.get("/posts", async (c) => {
  const { items } = await cms.posts.list();
  return c.json({ items });
});

app.get("/posts/:slug", async (c) => {
  const post = await cms.posts.find(c.req.param("slug"));
  if (!post) return c.json({ error: "Not Found" }, 404);
  const renderedHtml = renderBlocksToHtml(post.blocks, { links: post.links });
  return c.json({
    item: { id: post.meta.id, slug: post.slug, status: post.meta.status },
    html: renderedHtml,
  });
});

app.get("/posts/:slug/adjacent", async (c) => {
  const slug = c.req.param("slug");
  const { items } = await cms.posts.list({
    sort: [{ by: "publishedAt", direction: "desc" }],
  });
  const index = items.findIndex((item) => item.slug === slug);
  const prev = index > 0 ? items[index - 1] : null;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;
  return c.json({ prev: prev?.slug ?? null, next: next?.slug ?? null });
});

app.all("/api/cms/*", (c) => cms.fetch(c.req.raw));

// --- HTML UI ---

// React を使わないテンプレート向けの再検証スクリプト（タブ可視化のたびに reload し、
// サーバ側で同期済みの最新スナップショットを取得し直す）。
function revalidatorScript(): string {
  return '<script>document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")location.reload()});</script>';
}

function layout(title: string, body: string) {
  return html`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
      a { color: #0070f3; text-decoration: none; }
      a:hover { text-decoration: underline; }
      nav { margin-bottom: 24px; color: #666; font-size: 0.9em; }
      h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
      ul { padding-left: 1.2em; }
      li { margin: 6px 0; }
      article img { max-width: 100%; }
    </style>
  </head>
  <body>
    <nav><a href="/ui">トップ</a> › <a href="/ui/posts">記事一覧</a></nav>
    ${raw(body)}
    ${raw(revalidatorScript())}
  </body>
</html>`;
}

app.get("/", (c) => c.redirect("/ui"));

const COLLECTION_NAMES = ["posts"] as const;

app.get("/ui", (c) => {
  const list = COLLECTION_NAMES.map(
    (col) => `<li><a href="/ui/${col}">${col}</a></li>`,
  ).join("");
  return c.html(
    layout("Notion CMS", `<h1>Notion Headless CMS</h1><ul>${list}</ul>`),
  );
});

app.get("/ui/posts", async (c) => {
  const { items } = await cms.posts.list();
  const links = items
    .map((item) => `<li><a href="/ui/posts/${item.slug}">${item.slug}</a></li>`)
    .join("");
  return c.html(layout("記事一覧", `<h1>記事一覧</h1><ul>${links}</ul>`));
});

app.get("/ui/posts/:slug", async (c) => {
  const post = await cms.posts.find(c.req.param("slug"));
  if (!post)
    return c.html(
      layout("Not Found", "<h1>404 - 記事が見つかりません</h1>"),
      404,
    );
  const content = renderBlocksToHtml(post.blocks, { links: post.links });
  return c.html(
    layout(post.slug, `<h1>${post.slug}</h1><article>${content}</article>`),
  );
});
