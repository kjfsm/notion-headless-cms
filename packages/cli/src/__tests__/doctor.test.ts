import { describe, expect, it } from "vitest";

import type { DoctorInput } from "../doctor.js";
import { runDoctorChecks } from "../doctor.js";

function healthyInput(): DoctorInput {
  return {
    bindings: { kv: true, r2: true, durableObject: true },
    webhookSecretConfigured: true,
    tokenValid: true,
    syncStats: { lastSyncAt: "2026-01-01T00:00:00.000Z", failureCount: 0 },
    slugs: [{ collection: "posts", slug: "a" }],
  };
}

describe("runDoctorChecks", () => {
  it("全項目が健全なら ok: true", () => {
    const report = runDoctorChecks(healthyInput());
    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.status !== "error")).toBe(true);
  });

  it("KV/R2/DO binding が無ければそれぞれ error として報告する", () => {
    const report = runDoctorChecks({
      ...healthyInput(),
      bindings: { kv: false, r2: false, durableObject: false },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.filter((c) => c.status === "error")).toHaveLength(3);
    for (const check of report.checks.filter((c) => c.status === "error")) {
      expect(check.remediation).toBeTruthy();
    }
  });

  it("webhook secret 未設定は warn(error ではない)", () => {
    const report = runDoctorChecks({
      ...healthyInput(),
      webhookSecretConfigured: false,
    });
    const check = report.checks.find((c) => c.name === "Webhook secret");
    expect(check?.status).toBe("warn");
    expect(report.ok).toBe(true);
  });

  it("token 無効は error", () => {
    const report = runDoctorChecks({ ...healthyInput(), tokenValid: false });
    expect(report.checks.find((c) => c.name === "Notion token")?.status).toBe("error");
    expect(report.ok).toBe(false);
  });

  it("token 検証スキップ(unknown)は warn", () => {
    const report = runDoctorChecks({
      ...healthyInput(),
      tokenValid: "unknown",
    });
    expect(report.checks.find((c) => c.name === "Notion token")?.status).toBe("warn");
  });

  it("同期失敗件数が 1 件以上あれば warn", () => {
    const report = runDoctorChecks({
      ...healthyInput(),
      syncStats: { lastSyncAt: null, failureCount: 3 },
    });
    const check = report.checks.find((c) => c.name === "同期失敗");
    expect(check?.status).toBe("warn");
    expect(check?.message).toContain("3");
  });

  it("slug が重複していれば error", () => {
    const report = runDoctorChecks({
      ...healthyInput(),
      slugs: [
        { collection: "posts", slug: "a" },
        { collection: "posts", slug: "a" },
      ],
    });
    const check = report.checks.find((c) => c.name === "slug 重複");
    expect(check?.status).toBe("error");
    expect(check?.message).toContain("posts/a");
    expect(report.ok).toBe(false);
  });
});
