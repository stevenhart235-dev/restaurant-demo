import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "astro/config";

const demoRestaurantDirectory = fileURLToPath(
  new URL("../../restaurants/demo-pizza", import.meta.url),
);

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.DEMO_RESTAURANT_DIRECTORY": JSON.stringify(
        demoRestaurantDirectory,
      ),
    },
  },
});
