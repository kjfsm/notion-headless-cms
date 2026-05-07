import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.fn();
vi.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate, state: "idle" }),
}));

const { NotionRevalidator, useNotionRevalidate } = await import("../router.js");

afterEach(() => {
  // happy-dom の document には listener が残るので、コンポーネントを必ず unmount する。
  cleanup();
  revalidate.mockClear();
});

function Caller(props: {
  on?: "mount" | "visibility" | ("mount" | "visibility")[];
}) {
  useNotionRevalidate({ on: props.on });
  return null;
}

describe("useNotionRevalidate (react-router)", () => {
  it("既定で mount 時に 1 度 revalidate を呼ぶ", () => {
    render(<Caller />);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("on: 'visibility' 単独だと mount では revalidate しない", () => {
    render(<Caller on="visibility" />);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("on: 'visibility' で visibilitychange を監視し、visible 時に revalidate", () => {
    render(<Caller on="visibility" />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("on: 'visibility' で hidden 時は revalidate しない", () => {
    render(<Caller on="visibility" />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("<NotionRevalidator>", () => {
  it("レンダリング結果は null（useNotionRevalidate のラッパ）", () => {
    const { container } = render(<NotionRevalidator />);
    expect(container.firstChild).toBeNull();
    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
