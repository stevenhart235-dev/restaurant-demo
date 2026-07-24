import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MenuConfigLoadError } from "./load-menu-config.js";
import { RestaurantConfigLoadError } from "./load-restaurant-config.js";
import { buildSiteModel } from "./site-model.js";

const temporaryDirectories: string[] = [];

const restaurantConfiguration = {
  id: "test-restaurant",
  slug: "test-restaurant",
  name: "Test Restaurant",
  tagline: "Food worth sharing",
  description: "A neighborhood restaurant serving seasonal food.",
  phone: "+1 555 010 0000",
  email: "hello@example.com",
  address: {
    street: "100 Main Street",
    city: "Chicago",
    region: "IL",
    postalCode: "60601",
    country: "US",
  },
  businessHours: [
    {
      day: "monday",
      closed: false,
      open: "11:00",
      close: "21:00",
    },
  ],
  theme: "default",
  brandColors: {
    primary: "#123ABC",
  },
  assets: {
    logo: "assets/logo.svg",
    heroImage: "assets/hero.jpg",
  },
};

const menuConfiguration = {
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
};

async function createTemporaryRestaurant(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "site-model-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeConfigurationFiles(directory: string): Promise<void> {
  await mkdir(join(directory, "assets", "menu"), { recursive: true });
  await Promise.all([
    writeFile(
      join(directory, "restaurant.json"),
      JSON.stringify(restaurantConfiguration),
      "utf8",
    ),
    writeFile(
      join(directory, "menu.json"),
      JSON.stringify(menuConfiguration),
      "utf8",
    ),
    writeFile(join(directory, "assets", "logo.svg"), "<svg />", "utf8"),
    writeFile(join(directory, "assets", "hero.jpg"), "placeholder", "utf8"),
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

describe("buildSiteModel", () => {
  it("builds an immutable site model", async () => {
    const directory = await createTemporaryRestaurant();
    await writeConfigurationFiles(directory);

    const model = await buildSiteModel(directory);

    expect(model.restaurant).toEqual(restaurantConfiguration);
    expect(model.menu).toEqual(menuConfiguration);
    expect(model.assets.restaurant.logo).toMatchObject({
      reference: "assets/logo.svg",
      publicPath: "/assets/test-restaurant/logo.svg",
      role: "restaurant-logo",
    });
    expect(model.assets.menuItems["test-item"]).toMatchObject({
      publicPath: "/assets/test-restaurant/menu/test-item.svg",
      role: "menu-item-image",
      menuItemId: "test-item",
    });
    expect(model.contact).toEqual({
      phone: restaurantConfiguration.phone,
      email: restaurantConfiguration.email,
      address: restaurantConfiguration.address,
    });
    expect(model.branding).toEqual({
      theme: restaurantConfiguration.theme,
      colors: restaurantConfiguration.brandColors,
      assets: restaurantConfiguration.assets,
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.restaurant)).toBe(true);
    expect(Object.isFrozen(model.menu.sections)).toBe(true);
    expect(Object.isFrozen(model.assets.files)).toBe(true);
    expect(Object.isFrozen(model.contact.address)).toBe(true);
    expect(Object.isFrozen(model.branding.colors)).toBe(true);
  });

  it("propagates restaurant loading failures", async () => {
    const directory = await createTemporaryRestaurant();

    await expect(buildSiteModel(directory)).rejects.toMatchObject({
      name: "RestaurantConfigLoadError",
      code: "RESTAURANT_CONFIG_NOT_FOUND",
    } satisfies Partial<RestaurantConfigLoadError>);
  });

  it("propagates menu loading failures", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(
      join(directory, "restaurant.json"),
      JSON.stringify(restaurantConfiguration),
      "utf8",
    );

    await expect(buildSiteModel(directory)).rejects.toMatchObject({
      name: "MenuConfigLoadError",
      code: "MENU_CONFIG_NOT_FOUND",
    } satisfies Partial<MenuConfigLoadError>);
  });

  it("generates metadata with deterministic fallbacks", async () => {
    const directory = await createTemporaryRestaurant();
    await writeConfigurationFiles(directory);

    const completeModel = await buildSiteModel(directory);

    expect(completeModel.metadata).toEqual({
      pageTitle: "Test Restaurant | Food worth sharing",
      pageDescription: "A neighborhood restaurant serving seasonal food.",
    });

    await writeFile(
      join(directory, "restaurant.json"),
      JSON.stringify({
        ...restaurantConfiguration,
        tagline: undefined,
        description: undefined,
      }),
      "utf8",
    );

    const minimalModel = await buildSiteModel(directory);

    expect(minimalModel.metadata).toEqual({
      pageTitle: "Test Restaurant",
      pageDescription: "Test Restaurant",
    });
  });
});
