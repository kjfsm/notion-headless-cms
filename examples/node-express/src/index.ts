import express from "express";
import { cms } from "./lib/cms.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.get("/posts", async (_req, res) => {
	const { items } = await cms.cache.getList();
	res.json({ items });
});

app.get("/posts/:slug", async (req, res) => {
	const entry = await cms.cache.get(req.params.slug);
	if (!entry) {
		res.status(404).json({ error: "Not Found" });
		return;
	}
	res.json({ html: entry.html, item: entry.item });
});

app.get("/api/images/:hash", async (req, res) => {
	const binary = await cms.getCachedImage(req.params.hash);
	if (!binary) {
		res.status(404).send("Not Found");
		return;
	}
	res.set("Content-Type", binary.contentType ?? "application/octet-stream");
	res.set("Cache-Control", "public, max-age=31536000, immutable");
	res.send(Buffer.from(binary.data));
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
