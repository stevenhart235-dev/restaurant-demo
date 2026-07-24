import { describe, expect, it } from "vitest";

import {
  AssetOutputCollisionError,
  createAssetManifest,
} from "./asset-manifest.js";
import type { ResolvedAsset } from "./resolve-assets.js";
import type { SiteModel } from "./site-model.js";

function modelWithAsset(asset: ResolvedAsset): SiteModel {
  return {
    assets: { files: [asset] },
  } as unknown as SiteModel;
}

const firstAsset: ResolvedAsset = {
  reference: "assets/logo.svg",
  sourcePath: "/source/one/logo.svg",
  publicPath: "/assets/shared/logo.svg",
  role: "restaurant-logo",
};

describe("createAssetManifest", () => {
  it("deduplicates identical source and public paths", () => {
    const manifest = createAssetManifest([
      modelWithAsset(firstAsset),
      modelWithAsset(firstAsset),
    ]);

    expect(manifest).toEqual([firstAsset]);
  });

  it("fails when distinct source files target the same public path", () => {
    const conflictingAsset: ResolvedAsset = {
      ...firstAsset,
      sourcePath: "/source/two/logo.svg",
    };

    expect(() =>
      createAssetManifest([
        modelWithAsset(firstAsset),
        modelWithAsset(conflictingAsset),
      ]),
    ).toThrowError(AssetOutputCollisionError);

    try {
      createAssetManifest([
        modelWithAsset(firstAsset),
        modelWithAsset(conflictingAsset),
      ]);
    } catch (error) {
      expect(error).toMatchObject({
        code: "ASSET_OUTPUT_COLLISION",
        publicPath: "/assets/shared/logo.svg",
        existingSourcePath: "/source/one/logo.svg",
        conflictingSourcePath: "/source/two/logo.svg",
      });
    }
  });
});
