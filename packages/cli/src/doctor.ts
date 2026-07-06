export interface DoctorInput {
  readonly bindings: {
    readonly d1: boolean;
    readonly r2: boolean;
    readonly durableObject: boolean;
  };
  readonly webhookSecretConfigured: boolean;
  readonly tokenValid: boolean | "unknown";
  readonly syncStats: {
    readonly lastSyncAt: string | null;
    readonly failureCount: number;
  };
  readonly slugs: readonly {
    readonly collection: string;
    readonly slug: string;
  }[];
}

export type DoctorStatus = "ok" | "warn" | "error";

export interface DoctorCheck {
  readonly name: string;
  readonly status: DoctorStatus;
  readonly message: string;
  readonly remediation?: string;
}

export interface DoctorReport {
  readonly checks: readonly DoctorCheck[];
  readonly ok: boolean;
}

/**
 * binding 疎通・webhook 設定・token 権限・同期状態・slug 重複を診断する(`nhc doctor`)。
 * 実際の疎通確認(I/O)は呼び出し側が行い、この関数は結果の集約・報告に専念する
 * (テスト容易性のため純関数として実装)。
 */
export function runDoctorChecks(input: DoctorInput): DoctorReport {
  const checks: DoctorCheck[] = [];

  checks.push(
    input.bindings.d1
      ? {
          name: "D1 binding",
          status: "ok",
          message: "D1 database が bind されています",
        }
      : {
          name: "D1 binding",
          status: "error",
          message: "D1 database が見つかりません",
          remediation: "wrangler.toml に index 用 D1 database の binding を追加してください",
        },
  );

  checks.push(
    input.bindings.r2
      ? {
          name: "R2 binding",
          status: "ok",
          message: "R2 bucket が bind されています",
        }
      : {
          name: "R2 binding",
          status: "error",
          message: "R2 bucket が見つかりません",
          remediation: "wrangler.toml に entry 用 R2 bucket の binding を追加してください",
        },
  );

  checks.push(
    input.bindings.durableObject
      ? {
          name: "Durable Object binding",
          status: "ok",
          message: "SyncCoordinator DO が bind されています",
        }
      : {
          name: "Durable Object binding",
          status: "error",
          message: "Durable Object が見つかりません",
          remediation:
            "wrangler.toml に SyncCoordinator の new_sqlite_classes 設定を追加してください",
        },
  );

  checks.push(
    input.webhookSecretConfigured
      ? {
          name: "Webhook secret",
          status: "ok",
          message: "webhook secret が設定されています",
        }
      : {
          name: "Webhook secret",
          status: "warn",
          message: "webhook secret が未設定です(反映が差分ポーリング頼みになり遅延します)",
          remediation:
            "Notion integration に webhook を登録し、secret を環境変数に設定してください",
        },
  );

  if (input.tokenValid === "unknown") {
    checks.push({
      name: "Notion token",
      status: "warn",
      message: "token の検証をスキップしました",
    });
  } else {
    checks.push(
      input.tokenValid
        ? { name: "Notion token", status: "ok", message: "token は有効です" }
        : {
            name: "Notion token",
            status: "error",
            message: "token が無効です",
            remediation:
              "NOTION_TOKEN を確認し、インテグレーションが対象 DB に接続されているか確認してください",
          },
    );
  }

  checks.push(
    input.syncStats.failureCount > 0
      ? {
          name: "同期失敗",
          status: "warn",
          message: `直近の同期失敗が ${input.syncStats.failureCount} 件あります`,
          remediation: "nhc sync --verbose で再実行し、失敗詳細を確認してください",
        }
      : {
          name: "同期失敗",
          status: "ok",
          message: "同期失敗の記録はありません",
        },
  );

  const slugCounts = new Map<string, number>();
  for (const { collection, slug } of input.slugs) {
    const key = `${collection}/${slug}`;
    slugCounts.set(key, (slugCounts.get(key) ?? 0) + 1);
  }
  const duplicates = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  checks.push(
    duplicates.length === 0
      ? { name: "slug 重複", status: "ok", message: "slug の重複はありません" }
      : {
          name: "slug 重複",
          status: "error",
          message: `slug が重複しています: ${duplicates.join(", ")}`,
          remediation: "Notion 側で該当ページの slug プロパティを一意な値に修正してください",
        },
  );

  return { checks, ok: checks.every((c) => c.status !== "error") };
}
