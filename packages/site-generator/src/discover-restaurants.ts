import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { buildSiteModel, type SiteModel } from "./site-model.js";

export type RestaurantDiscoveryErrorCode =
  | "RESTAURANTS_ROOT_NOT_FOUND"
  | "RESTAURANTS_ROOT_NOT_DIRECTORY"
  | "INCOMPLETE_RESTAURANT_DIRECTORY"
  | "INVALID_RESTAURANT_SOURCE"
  | "DUPLICATE_RESTAURANT_SLUG";

export class RestaurantDiscoveryError extends Error {
  readonly code: RestaurantDiscoveryErrorCode;
  readonly path: string;
  readonly conflictingPath?: string;
  readonly slug?: string;

  constructor(options: {
    code: RestaurantDiscoveryErrorCode;
    message: string;
    path: string;
    conflictingPath?: string;
    slug?: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "RestaurantDiscoveryError";
    this.code = options.code;
    this.path = options.path;
    this.conflictingPath = options.conflictingPath;
    this.slug = options.slug;
  }
}

export interface DiscoveredRestaurant {
  readonly directoryPath: string;
  readonly routePath: string;
  readonly model: SiteModel;
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function requireConfigurationFiles(directoryPath: string): Promise<void> {
  const configurationPaths = [
    resolve(directoryPath, "restaurant.json"),
    resolve(directoryPath, "menu.json"),
  ];
  const results = await Promise.all(
    configurationPaths.map(async (configurationPath) => {
      try {
        return (await stat(configurationPath)).isFile();
      } catch (error) {
        if (isNotFoundError(error)) {
          return false;
        }
        throw error;
      }
    }),
  );

  if (results.some((isFile) => !isFile)) {
    throw new RestaurantDiscoveryError({
      code: "INCOMPLETE_RESTAURANT_DIRECTORY",
      message: `Restaurant source directory is incomplete: "${directoryPath}" (expected restaurant.json and menu.json files)`,
      path: directoryPath,
    });
  }
}

export function getRestaurantRoutePath(slug: string): string {
  return `/${slug}/`;
}

export async function discoverRestaurants(
  restaurantsRootDirectoryPath: string,
): Promise<readonly DiscoveredRestaurant[]> {
  const rootPath = resolve(restaurantsRootDirectoryPath);
  let rootStat;

  try {
    rootStat = await stat(rootPath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new RestaurantDiscoveryError({
        code: "RESTAURANTS_ROOT_NOT_FOUND",
        message: `Restaurants root not found: "${rootPath}"`,
        path: rootPath,
        cause: error,
      });
    }
    throw error;
  }

  if (!rootStat.isDirectory()) {
    throw new RestaurantDiscoveryError({
      code: "RESTAURANTS_ROOT_NOT_DIRECTORY",
      message: `Restaurants root is not a directory: "${rootPath}"`,
      path: rootPath,
    });
  }

  const childDirectories = (await readdir(rootPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name));
  const discovered: DiscoveredRestaurant[] = [];
  const pathsBySlug = new Map<string, string>();

  for (const childDirectory of childDirectories) {
    const directoryPath = resolve(rootPath, childDirectory.name);
    await requireConfigurationFiles(directoryPath);

    let model: SiteModel;
    try {
      model = await buildSiteModel(directoryPath);
    } catch (error) {
      throw new RestaurantDiscoveryError({
        code: "INVALID_RESTAURANT_SOURCE",
        message: `Restaurant source directory is invalid: "${directoryPath}"`,
        path: directoryPath,
        cause: error,
      });
    }

    const existingPath = pathsBySlug.get(model.restaurant.slug);
    if (existingPath !== undefined) {
      throw new RestaurantDiscoveryError({
        code: "DUPLICATE_RESTAURANT_SLUG",
        message: `Duplicate restaurant slug "${model.restaurant.slug}" in "${existingPath}" and "${directoryPath}"`,
        path: existingPath,
        conflictingPath: directoryPath,
        slug: model.restaurant.slug,
      });
    }

    pathsBySlug.set(model.restaurant.slug, directoryPath);
    discovered.push(
      Object.freeze({
        directoryPath,
        routePath: getRestaurantRoutePath(model.restaurant.slug),
        model,
      }),
    );
  }

  discovered.sort((left, right) =>
    left.model.restaurant.slug.localeCompare(right.model.restaurant.slug),
  );
  return Object.freeze(discovered);
}
