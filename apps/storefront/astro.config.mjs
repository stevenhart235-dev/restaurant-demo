import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "astro/config";
import {
  createAssetManifest,
  discoverRestaurants,
} from "@restaurant-platform/site-generator";

const restaurantsRootDirectory = fileURLToPath(
  new URL("../../restaurants", import.meta.url),
);

const copyRestaurantAssets = {
  name: "copy-restaurant-assets",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const restaurants = await discoverRestaurants(restaurantsRootDirectory);
      const assetManifest = createAssetManifest(
        restaurants.map((restaurant) => restaurant.model),
      );

      await Promise.all(
        assetManifest.map(async (asset) => {
          const destinationPath = fileURLToPath(
            new URL(asset.publicPath.slice(1), dir),
          );
          await mkdir(dirname(destinationPath), { recursive: true });
          await copyFile(asset.sourcePath, destinationPath);
        }),
      );
    },
  },
};

export default defineConfig({
  integrations: [copyRestaurantAssets],
  vite: {
    define: {
      "import.meta.env.RESTAURANTS_ROOT_DIRECTORY": JSON.stringify(
        restaurantsRootDirectory,
      ),
    },
  },
});
