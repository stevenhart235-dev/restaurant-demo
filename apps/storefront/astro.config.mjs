import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "astro/config";
import { buildSiteModel } from "@restaurant-platform/site-generator";

const demoRestaurantDirectory = fileURLToPath(
  new URL("../../restaurants/demo-pizza", import.meta.url),
);

const copyRestaurantAssets = {
  name: "copy-restaurant-assets",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const model = await buildSiteModel(demoRestaurantDirectory);

      await Promise.all(
        model.assets.files.map(async (asset) => {
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
      "import.meta.env.DEMO_RESTAURANT_DIRECTORY": JSON.stringify(
        demoRestaurantDirectory,
      ),
    },
  },
});
