import DefaultTheme from "./default/DefaultTheme.astro";
import type { StorefrontTheme } from "./contract.js";

export const DEFAULT_THEME_ID = "default";

const defaultTheme = {
  id: DEFAULT_THEME_ID,
  metadata: {
    name: "Default Restaurant",
    description:
      "A clear, accessible restaurant storefront with contact details, hours, and a complete menu.",
  },
  component: DefaultTheme,
  presentation: {
    locale: "en-US",
    defaultSecondaryColor: "#fff7ed",
    defaultAccentColor: "#7f1d1d",
  },
} as const satisfies StorefrontTheme;

const registeredThemes = {
  [DEFAULT_THEME_ID]: defaultTheme,
} as const;

export type RegisteredThemeIdentifier = keyof typeof registeredThemes;

export class UnknownThemeError extends Error {
  readonly code = "UNKNOWN_THEME";
  readonly themeIdentifier: string;

  constructor(themeIdentifier: string) {
    super(`Unknown storefront theme: "${themeIdentifier}"`);
    this.name = "UnknownThemeError";
    this.themeIdentifier = themeIdentifier;
  }
}

export function resolveTheme(themeIdentifier: string): StorefrontTheme {
  if (themeIdentifier in registeredThemes) {
    return registeredThemes[
      themeIdentifier as RegisteredThemeIdentifier
    ] satisfies StorefrontTheme;
  }

  throw new UnknownThemeError(themeIdentifier);
}
