import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { posix } from "node:path";

import type { MenuConfig, RestaurantConfig } from "@restaurant-platform/shared";

export type ResolvedAssetRole =
  "restaurant-logo" | "restaurant-hero" | "menu-item-image";

export interface ResolvedAsset {
  readonly reference: string;
  readonly sourcePath: string;
  readonly publicPath: string;
  readonly role: ResolvedAssetRole;
  readonly menuItemId?: string;
}

export interface ResolvedSiteAssets {
  readonly restaurant: Readonly<{
    logo?: ResolvedAsset;
    heroImage?: ResolvedAsset;
  }>;
  readonly menuItems: Readonly<Record<string, ResolvedAsset>>;
  readonly files: readonly ResolvedAsset[];
}

export type AssetResolutionErrorCode =
  "ASSET_NOT_FOUND" | "ASSET_NOT_FILE" | "ASSET_PATH_ESCAPE";

export class AssetResolutionError extends Error {
  readonly code: AssetResolutionErrorCode;
  readonly reference: string;
  readonly sourcePath: string;
  readonly role: ResolvedAssetRole;

  constructor(
    code: AssetResolutionErrorCode,
    message: string,
    asset: Readonly<{
      reference: string;
      sourcePath: string;
      role: ResolvedAssetRole;
    }>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AssetResolutionError";
    this.code = code;
    this.reference = asset.reference;
    this.sourcePath = asset.sourcePath;
    this.role = asset.role;
  }
}

const isMissingPathError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

function isPathContained(parentPath: string, candidatePath: string): boolean {
  const relativePath = relative(parentPath, candidatePath);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

async function resolveAsset(
  restaurantDirectory: string,
  restaurantSlug: string,
  reference: string,
  role: ResolvedAssetRole,
  menuItemId?: string,
): Promise<ResolvedAsset> {
  const assetsDirectory = resolve(restaurantDirectory, "assets");
  const assetRelativePath = reference.slice("assets/".length);
  const sourcePath = resolve(restaurantDirectory, reference);
  const errorContext = { reference, sourcePath, role };

  if (
    !reference.startsWith("assets/") ||
    !isPathContained(assetsDirectory, sourcePath)
  ) {
    throw new AssetResolutionError(
      "ASSET_PATH_ESCAPE",
      `Asset reference escapes the restaurant assets directory: "${reference}"`,
      errorContext,
    );
  }

  let assetStats;

  try {
    assetStats = await stat(sourcePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new AssetResolutionError(
        "ASSET_NOT_FOUND",
        `Asset file not found: "${sourcePath}"`,
        errorContext,
        { cause: error },
      );
    }

    throw error;
  }

  if (!assetStats.isFile()) {
    throw new AssetResolutionError(
      "ASSET_NOT_FILE",
      `Asset path is not a file: "${sourcePath}"`,
      errorContext,
    );
  }

  const [realAssetsDirectory, realSourcePath] = await Promise.all([
    realpath(assetsDirectory),
    realpath(sourcePath),
  ]);

  if (!isPathContained(realAssetsDirectory, realSourcePath)) {
    throw new AssetResolutionError(
      "ASSET_PATH_ESCAPE",
      `Asset file resolves outside the restaurant assets directory: "${sourcePath}"`,
      errorContext,
    );
  }

  return {
    reference,
    sourcePath,
    publicPath: posix.join(
      "/assets",
      restaurantSlug,
      assetRelativePath.replaceAll("\\", "/"),
    ),
    role,
    ...(menuItemId ? { menuItemId } : {}),
  };
}

export async function resolveSiteAssets(
  restaurantDirectoryPath: string,
  restaurant: RestaurantConfig,
  menu: MenuConfig,
): Promise<ResolvedSiteAssets> {
  const restaurantDirectory = resolve(restaurantDirectoryPath);
  const files: ResolvedAsset[] = [];
  const restaurantAssets: {
    logo?: ResolvedAsset;
    heroImage?: ResolvedAsset;
  } = {};
  const menuItems: Record<string, ResolvedAsset> = {};

  if (restaurant.assets?.logo) {
    restaurantAssets.logo = await resolveAsset(
      restaurantDirectory,
      restaurant.slug,
      restaurant.assets.logo,
      "restaurant-logo",
    );
    files.push(restaurantAssets.logo);
  }

  if (restaurant.assets?.heroImage) {
    restaurantAssets.heroImage = await resolveAsset(
      restaurantDirectory,
      restaurant.slug,
      restaurant.assets.heroImage,
      "restaurant-hero",
    );
    files.push(restaurantAssets.heroImage);
  }

  for (const section of menu.sections) {
    for (const item of section.items) {
      if (item.image) {
        const asset = await resolveAsset(
          restaurantDirectory,
          restaurant.slug,
          item.image,
          "menu-item-image",
          item.id,
        );
        menuItems[item.id] = asset;
        files.push(asset);
      }
    }
  }

  return {
    restaurant: restaurantAssets,
    menuItems,
    files,
  };
}
