import { describe, expect, it, vi } from "vitest";

vi.mock("./default/DefaultTheme.astro", () => ({
  default: () => undefined,
}));

import {
  DEFAULT_THEME_ID,
  resolveTheme,
  UnknownThemeError,
} from "./registry.js";

describe("theme registry", () => {
  it("resolves the registered default theme", () => {
    const theme = resolveTheme(DEFAULT_THEME_ID);

    expect(theme.id).toBe("default");
    expect(theme.component).toBeTypeOf("function");
  });

  it("fails clearly for an unknown theme", () => {
    expect(() => resolveTheme("missing-theme")).toThrowError(
      new UnknownThemeError("missing-theme"),
    );
  });

  it("exposes stable theme metadata and presentation configuration", () => {
    const theme = resolveTheme(DEFAULT_THEME_ID);

    expect(theme.metadata).toEqual({
      name: "Default Restaurant",
      description:
        "A clear, accessible restaurant storefront with contact details, hours, and a complete menu.",
    });
    expect(theme.presentation).toEqual({
      locale: "en-US",
      defaultSecondaryColor: "#fff7ed",
      defaultAccentColor: "#7f1d1d",
    });
  });
});
