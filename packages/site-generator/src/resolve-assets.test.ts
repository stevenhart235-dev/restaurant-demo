import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  MenuConfigSchema,
  RestaurantConfigSchema,
} from "@restaurant-platform/shared";
import { afterEach, describe, expect, it } from "vitest";

import { AssetResolutionError, resolveSiteAssets } from "./resolve-assets.js";

const temporaryDirectories: string[] = [];

const restaurant = RestaurantConfigSchema.parse({
  id: "test-restaurant",
  slug: "test-restaurant",
  name: "Test Restaurant",
  phone: "+1 555 010 0000",
  address: {
    street: "100 Main Street",
    city: "Chicago",
    region: "IL",
    postalCode: "60601",
    country: "US",
  },
  businessHours: [{ day: "monday", closed: true }],
  theme: "default",
  brandColors: { primary: "#123ABC" },
  assets: {
    logo: "assets/logo.svg",
    heroImage: "assets/hero.svg",
  },
});

const menu = MenuConfigSchema.parse({
  id: "test-menu",
  name: "Test Menu",
  currency: "USD",
  sections: [
    {
      id: "mains",
      name: "Mains",
      displayOrder: 1,
      items: [
        {
          id: "test-item",
          name: "Test Item",
          prices: [{ amount: 12.5 }],
          image: "assets/menu/test-item.svg",
        },
      ],
    },
  ],
});

async function createTemporaryRestaurant(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "resolved-assets-"));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, "assets", "menu"), { recursive: true });
  return directory;
}

async function writeDemoAssets(directory: string): Promise<void> {
  await Promise.all([
    writeFile(join(directory, "assets", "logo.svg"), "<svg />", "utf8"),
    writeFile(join(directory, "assets", "hero.svg"), "<svg />", "utf8"),
    writeFile(
      join(directory, "assets", "menu", "test-item.svg"),
      "<svg />",
      "utf8",
    ),
  ]);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("resolveSiteAssets", () => {
  it("resolves restaurant and menu assets without reading their contents", async () => {
    const directory = await createTemporaryRestaurant();
    await writeDemoAssets(directory);

    const assets = await resolveSiteAssets(directory, restaurant, menu);

    expect(assets.restaurant.logo).toMatchObject({
      reference: "assets/logo.svg",
      sourcePath: resolve(directory, "assets/logo.svg"),
      publicPath: "/assets/test-restaurant/logo.svg",
      role: "restaurant-logo",
    });
    expect(assets.restaurant.heroImage?.role).toBe("restaurant-hero");
    expect(assets.menuItems["test-item"]).toMatchObject({
      publicPath: "/assets/test-restaurant/menu/test-item.svg",
      role: "menu-item-image",
      menuItemId: "test-item",
    });
    expect(assets.files).toHaveLength(3);
  });

  it("rejects a missing asset", async () => {
    const directory = await createTemporaryRestaurant();

    await expect(
      resolveSiteAssets(directory, restaurant, menu),
    ).rejects.toMatchObject({
      name: "AssetResolutionError",
      code: "ASSET_NOT_FOUND",
      reference: "assets/logo.svg",
    } satisfies Partial<AssetResolutionError>);
  });

  it("rejects a directory where a file is expected", async () => {
    const directory = await createTemporaryRestaurant();
    await mkdir(join(directory, "assets", "logo.svg"));

    await expect(
      resolveSiteAssets(directory, restaurant, menu),
    ).rejects.toMatchObject({
      name: "AssetResolutionError",
      code: "ASSET_NOT_FILE",
      reference: "assets/logo.svg",
    } satisfies Partial<AssetResolutionError>);
  });

  it("enforces containment beneath the restaurant assets directory", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(join(directory, "outside.svg"), "<svg />", "utf8");
    const escapingRestaurant = {
      ...restaurant,
      assets: {
        logo: "assets/../outside.svg",
      },
    };

    await expect(
      resolveSiteAssets(directory, escapingRestaurant, menu),
    ).rejects.toMatchObject({
      name: "AssetResolutionError",
      code: "ASSET_PATH_ESCAPE",
      reference: "assets/../outside.svg",
    } satisfies Partial<AssetResolutionError>);
  });

  it("generates deterministic restaurant-scoped public paths", async () => {
    const directory = await createTemporaryRestaurant();
    await writeDemoAssets(directory);

    const firstResult = await resolveSiteAssets(directory, restaurant, menu);
    const secondResult = await resolveSiteAssets(directory, restaurant, menu);

    expect(firstResult.files.map((asset) => asset.publicPath)).toEqual(
      secondResult.files.map((asset) => asset.publicPath),
    );
    expect(firstResult.files.map((asset) => asset.publicPath)).toEqual([
      "/assets/test-restaurant/logo.svg",
      "/assets/test-restaurant/hero.svg",
      "/assets/test-restaurant/menu/test-item.svg",
    ]);
  });
});
