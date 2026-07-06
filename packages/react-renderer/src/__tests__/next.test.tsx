import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const { NotionRevalidator, useNotionRevalidate } = await import("../next.js");

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

function Caller(props: { on?: "mount" | "visibility" | ("mount" | "visibility")[] }) {
  useNotionRevalidate({ on: props.on });
  return null;
}

describe("useNotionRevalidate (next)", () => {
  it("既定で mount 時に 1 度 router.refresh を呼ぶ", () => {
    render(<Caller />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("on: 'visibility' で visibilitychange を監視し、visible 時に refresh", () => {
    render(<Caller on="visibility" />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("<NotionRevalidator> (next)", () => {
  it("null をレンダリングする", () => {
    const { container } = render(<NotionRevalidator />);
    expect(container.firstChild).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
