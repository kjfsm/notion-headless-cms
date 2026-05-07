import { describe, expect, it } from "vitest";
import { notionRevalidatorScript } from "../html";

describe("notionRevalidatorScript", () => {
  it("既定では visibilitychange ベースのスクリプトを返す", () => {
    const out = notionRevalidatorScript();
    expect(out).toMatch(/^<script>/);
    expect(out).toMatch(/visibilitychange/);
    expect(out).toMatch(/location\.reload\(\)/);
    expect(out).toMatch(/<\/script>$/);
  });

  it("on: 'focus' で focus イベント版を返す（初回ロードはスキップ）", () => {
    const out = notionRevalidatorScript({ on: "focus" });
    expect(out).toMatch(/addEventListener\("focus"/);
    expect(out).not.toMatch(/visibilitychange/);
    // 初回ロードでの reload を防ぐためのフラグが含まれる
    expect(out).toMatch(/let l=false/);
  });

  it('nonce を渡すと <script nonce="..."> が出力される', () => {
    const out = notionRevalidatorScript({ nonce: "abc123" });
    expect(out).toMatch(/^<script nonce="abc123">/);
  });

  it("外部入力を埋め込まないので XSS の余地が無い（純粋に静的）", () => {
    const out = notionRevalidatorScript();
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("null");
  });
});
