/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NotionThemeProvider } from "../NotionThemeProvider";

describe("NotionThemeProvider", () => {
  afterEach(() => cleanup());

  it("theme='light' で darkClassName が付かない", () => {
    const { container } = render(
      <NotionThemeProvider theme="light">
        <span>x</span>
      </NotionThemeProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.dataset.notionTheme).toBe("light");
  });

  it("theme='dark' でルート div に dark クラスが付く", () => {
    const { container } = render(
      <NotionThemeProvider theme="dark">
        <span>x</span>
      </NotionThemeProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.dataset.notionTheme).toBe("dark");
  });

  it("darkClassName のカスタマイズが効く", () => {
    const { container } = render(
      <NotionThemeProvider theme="dark" darkClassName="theme-dark">
        <span>x</span>
      </NotionThemeProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("theme-dark")).toBe(true);
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("theme='system' は初期描画では light として扱う", () => {
    const { container } = render(
      <NotionThemeProvider theme="system">
        <span>x</span>
      </NotionThemeProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.notionTheme).toBe("light");
  });

  it("className を合成する", () => {
    const { container } = render(
      <NotionThemeProvider theme="dark" className="prose">
        <span>x</span>
      </NotionThemeProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("prose")).toBe(true);
    expect(root.classList.contains("dark")).toBe(true);
  });
});
