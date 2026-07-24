import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { MenuConfigSchema, type MenuConfig } from "@restaurant-platform/shared";

export type MenuConfigLoadErrorCode =
  | "RESTAURANT_DIRECTORY_NOT_FOUND"
  | "MENU_CONFIG_NOT_FOUND"
  | "INVALID_MENU_JSON"
  | "INVALID_MENU_CONFIG";

export class MenuConfigLoadError extends Error {
  readonly code: MenuConfigLoadErrorCode;
  readonly path: string;

  constructor(
    code: MenuConfigLoadErrorCode,
    message: string,
    path: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MenuConfigLoadError";
    this.code = code;
    this.path = path;
  }
}

const isMissingPathError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export async function loadMenuConfig(
  restaurantDirectoryPath: string,
): Promise<MenuConfig> {
  const restaurantDirectory = resolve(restaurantDirectoryPath);

  let directoryStats;

  try {
    directoryStats = await stat(restaurantDirectory);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new MenuConfigLoadError(
        "RESTAURANT_DIRECTORY_NOT_FOUND",
        `Restaurant directory not found: "${restaurantDirectory}"`,
        restaurantDirectory,
        { cause: error },
      );
    }

    throw error;
  }

  if (!directoryStats.isDirectory()) {
    throw new MenuConfigLoadError(
      "RESTAURANT_DIRECTORY_NOT_FOUND",
      `Restaurant directory not found: "${restaurantDirectory}"`,
      restaurantDirectory,
    );
  }

  const configurationPath = join(restaurantDirectory, "menu.json");
  let source: string;

  try {
    source = await readFile(configurationPath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new MenuConfigLoadError(
        "MENU_CONFIG_NOT_FOUND",
        `Menu configuration not found: "${configurationPath}"`,
        configurationPath,
        { cause: error },
      );
    }

    throw error;
  }

  let input: unknown;

  try {
    input = JSON.parse(source);
  } catch (error) {
    throw new MenuConfigLoadError(
      "INVALID_MENU_JSON",
      `Menu configuration contains invalid JSON: "${configurationPath}"`,
      configurationPath,
      { cause: error },
    );
  }

  const result = MenuConfigSchema.safeParse(input);

  if (!result.success) {
    throw new MenuConfigLoadError(
      "INVALID_MENU_CONFIG",
      `Menu configuration failed schema validation: "${configurationPath}"`,
      configurationPath,
      { cause: result.error },
    );
  }

  return result.data;
}
