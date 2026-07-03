import { describe, expect, it } from "vitest";
import {
  generateMountCodeTemplate,
  generateSchemaTemplate,
  generateWranglerToml,
} from "../init.js";

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

  it("マウントコード雛形が createFetchHandler/createScheduledHandler を import する", () => {
    const code = generateMountCodeTemplate();
    expect(code).toContain("createFetchHandler");
    expect(code).toContain("createScheduledHandler");
  });
});
