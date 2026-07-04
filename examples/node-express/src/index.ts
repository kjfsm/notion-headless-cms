import { app } from "./app.js";
import { syncAll } from "./lib/cms.js";

await syncAll();

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
