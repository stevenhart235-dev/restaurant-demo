import type { AstroComponentFactory } from "astro/runtime/server/index.js";

export interface ThemeMetadata {
  readonly name: string;
  readonly description: string;
}

export interface ThemePresentationConfig {
  readonly locale: string;
  readonly defaultSecondaryColor: string;
  readonly defaultAccentColor: string;
}

export interface StorefrontTheme {
  readonly id: string;
  readonly metadata: ThemeMetadata;
  readonly component: AstroComponentFactory;
  readonly presentation: ThemePresentationConfig;
}
