import { describe, expect, it } from "vitest";

import {
  generateMountCodeTemplate,
  generateSchemaTemplate,
  generateWranglerToml,
} from "../scaffold.js";

describe("generateWranglerToml", () => {
  it("projectName・binding 名を反映した wrangler.toml を生成する", () => {
    const toml = generateWranglerToml({ projectName: "my-blog" });
    expect(toml).toContain('name = "my-blog"');
    expect(toml).toContain('binding = "DOC_INDEX"');
    expect(toml).toContain('binding = "ENTRY_BUCKET"');
    expect(toml).toContain('class_name = "SyncCoordinatorDO"');
    expect(toml).toContain('new_sqlite_classes = ["SyncCoordinatorDO"]');
    expect(toml).toContain("[triggers]");
  });

  it("binding 名をカスタマイズできる", () => {
    const toml = generateWranglerToml({
      projectName: "x",
      kvBinding: "MY_KV",
      r2Binding: "MY_R2",
      doClassName: "MyDO",
    });
    expect(toml).toContain('binding = "MY_KV"');
    expect(toml).toContain('binding = "MY_R2"');
    expect(toml).toContain('class_name = "MyDO"');
  });
});

describe("generateSchemaTemplate / generateMountCodeTemplate", () => {
  it("スキーマ雛形が defineSchema/defineCollection/prop を import する", () => {
    const code = generateSchemaTemplate();
    expect(code).toContain(
      'import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";',
    );
    expect(code).toContain("export const schema = defineSchema({ posts });");
  });

  it("マウントコード雛形は 3 ファイル(do/cms/index)を生成し、not implemented を含まない", () => {
    const files = generateMountCodeTemplate({ projectName: "my-blog" });
    expect(Object.keys(files).sort()).toEqual(
      ["src/index.ts", "src/lib/cms.ts", "src/lib/do.ts"].sort(),
    );
    for (const content of Object.values(files)) {
      expect(content).not.toContain("not implemented");
    }
  });

  it("do.ts が createSyncCoordinatorDO でバインディング名を反映して DO を組み立てる", () => {
    const files = generateMountCodeTemplate({
      projectName: "my-blog",
      kvBinding: "MY_KV",
      r2Binding: "MY_R2",
      doClassName: "MyDO",
    });
    const doFile = files["src/lib/do.ts"];
    expect(doFile).toContain("createSyncCoordinatorDO<Env>");
    expect(doFile).toContain("export const MyDO =");
    expect(doFile).toContain("kvDocStore(env.MY_KV)");
    expect(doFile).toContain("r2BlobStore(env.MY_R2)");
  });

  it("cms.ts が durableObjectSyncDelegate 経由で読者用 Worker インスタンスを組み立てる", () => {
    const files = generateMountCodeTemplate({
      projectName: "my-blog",
      doBindingName: "MY_SYNC",
    });
    const cmsFile = files["src/lib/cms.ts"];
    expect(cmsFile).toContain("durableObjectSyncDelegate");
    expect(cmsFile).toContain("env.MY_SYNC.idFromName");
  });

  it("index.ts が DO を re-export し、cms.fetch()/scheduled() をマウントする", () => {
    const files = generateMountCodeTemplate({
      projectName: "my-blog",
      doClassName: "MyDO",
    });
    const indexFile = files["src/index.ts"];
    expect(indexFile).toContain('export { MyDO } from "./lib/do.js";');
    expect(indexFile).toContain("makeCms(c.env, c.executionCtx).fetch(c.req.raw)");
    expect(indexFile).toContain("makeCms(env, ctx).scheduled()");
  });
});
