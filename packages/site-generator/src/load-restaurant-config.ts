import { readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  RestaurantConfigSchema,
  type RestaurantConfig,
} from "@restaurant-platform/shared";

export type RestaurantConfigLoadErrorCode =
  | "RESTAURANT_DIRECTORY_NOT_FOUND"
  | "RESTAURANT_CONFIG_NOT_FOUND"
  | "INVALID_RESTAURANT_JSON"
  | "INVALID_RESTAURANT_CONFIG";

export class RestaurantConfigLoadError extends Error {
  readonly code: RestaurantConfigLoadErrorCode;
  readonly path: string;

  constructor(
    code: RestaurantConfigLoadErrorCode,
    message: string,
    path: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RestaurantConfigLoadError";
    this.code = code;
    this.path = path;
  }
}

const isMissingPathError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export async function loadRestaurantConfig(
  restaurantDirectoryPath: string,
): Promise<RestaurantConfig> {
  const restaurantDirectory = resolve(restaurantDirectoryPath);

  let directoryStats;

  try {
    directoryStats = await stat(restaurantDirectory);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new RestaurantConfigLoadError(
        "RESTAURANT_DIRECTORY_NOT_FOUND",
        `Restaurant directory not found: "${restaurantDirectory}"`,
        restaurantDirectory,
        { cause: error },
      );
    }

    throw error;
  }

  if (!directoryStats.isDirectory()) {
    throw new RestaurantConfigLoadError(
      "RESTAURANT_DIRECTORY_NOT_FOUND",
      `Restaurant directory not found: "${restaurantDirectory}"`,
      restaurantDirectory,
    );
  }

  const configurationPath = join(restaurantDirectory, "restaurant.json");
  let source: string;

  try {
    source = await readFile(configurationPath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new RestaurantConfigLoadError(
        "RESTAURANT_CONFIG_NOT_FOUND",
        `Restaurant configuration not found: "${configurationPath}"`,
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
    throw new RestaurantConfigLoadError(
      "INVALID_RESTAURANT_JSON",
      `Restaurant configuration contains invalid JSON: "${configurationPath}"`,
      configurationPath,
      { cause: error },
    );
  }

  const result = RestaurantConfigSchema.safeParse(input);

  if (!result.success) {
    throw new RestaurantConfigLoadError(
      "INVALID_RESTAURANT_CONFIG",
      `Restaurant configuration failed schema validation: "${configurationPath}"`,
      configurationPath,
      { cause: result.error },
    );
  }

  return result.data;
}
