import type { ResolvedAsset } from "./resolve-assets.js";
import type { SiteModel } from "./site-model.js";

export class AssetOutputCollisionError extends Error {
  readonly code = "ASSET_OUTPUT_COLLISION";
  readonly publicPath: string;
  readonly existingSourcePath: string;
  readonly conflictingSourcePath: string;

  constructor(
    publicPath: string,
    existingSourcePath: string,
    conflictingSourcePath: string,
  ) {
    super(
      `Conflicting asset output path "${publicPath}": "${existingSourcePath}" and "${conflictingSourcePath}"`,
    );
    this.name = "AssetOutputCollisionError";
    this.publicPath = publicPath;
    this.existingSourcePath = existingSourcePath;
    this.conflictingSourcePath = conflictingSourcePath;
  }
}

export function createAssetManifest(
  siteModels: readonly SiteModel[],
): readonly ResolvedAsset[] {
  const assetsByPublicPath = new Map<string, ResolvedAsset>();

  for (const model of siteModels) {
    for (const asset of model.assets.files) {
      const existingAsset = assetsByPublicPath.get(asset.publicPath);
      if (
        existingAsset !== undefined &&
        existingAsset.sourcePath !== asset.sourcePath
      ) {
        throw new AssetOutputCollisionError(
          asset.publicPath,
          existingAsset.sourcePath,
          asset.sourcePath,
        );
      }
      assetsByPublicPath.set(asset.publicPath, asset);
    }
  }

  return Object.freeze(
    [...assetsByPublicPath.values()].sort((left, right) =>
      left.publicPath.localeCompare(right.publicPath),
    ),
  );
}
