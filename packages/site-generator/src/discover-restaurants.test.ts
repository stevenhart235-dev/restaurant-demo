import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  discoverRestaurants,
  getRestaurantRoutePath,
  RestaurantDiscoveryError,
} from "./discover-restaurants.js";

const temporaryDirectories: string[] = [];

function restaurantConfiguration(slug: string) {
  return {
    id: slug,
    slug,
    name: `Restaurant ${slug}`,
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
  };
}

const menuConfiguration = {
  id: "main-menu",
  name: "Main Menu",
  currency: "USD",
  sections: [
    {
      id: "mains",
      name: "Mains",
      displayOrder: 1,
      items: [
        {
          id: "main-item",
          name: "Main Item",
          prices: [{ amount: 12 }],
        },
      ],
    },
  ],
};

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "restaurant-discovery-"));
  temporaryDirectories.push(root);
  return root;
}

async function writeRestaurant(
  root: string,
  directoryName: string,
  slug = directoryName,
): Promise<void> {
  const directory = join(root, directoryName);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      join(directory, "restaurant.json"),
      JSON.stringify(restaurantConfiguration(slug)),
      "utf8",
    ),
    writeFile(
      join(directory, "menu.json"),
      JSON.stringify(menuConfiguration),
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

describe("discoverRestaurants", () => {
  it("discovers multiple restaurants in deterministic slug order", async () => {
    const root = await createRoot();
    await writeRestaurant(root, "first-on-disk", "zeta");
    await writeRestaurant(root, "second-on-disk", "alpha");
    await mkdir(join(root, ".ignored"), { recursive: true });
    await writeFile(join(root, "notes.txt"), "ignored", "utf8");

    const restaurants = await discoverRestaurants(root);

    expect(
      restaurants.map((restaurant) => restaurant.model.restaurant.slug),
    ).toEqual(["alpha", "zeta"]);
    expect(restaurants.map((restaurant) => restaurant.routePath)).toEqual([
      "/alpha/",
      "/zeta/",
    ]);
  });

  it("fails when the restaurants root is missing", async () => {
    const root = await createRoot();

    await expect(
      discoverRestaurants(join(root, "missing")),
    ).rejects.toMatchObject({
      code: "RESTAURANTS_ROOT_NOT_FOUND",
    });
  });

  it("fails when the restaurants root is not a directory", async () => {
    const root = await createRoot();
    const filePath = join(root, "restaurants.txt");
    await writeFile(filePath, "not a directory", "utf8");

    await expect(discoverRestaurants(filePath)).rejects.toMatchObject({
      code: "RESTAURANTS_ROOT_NOT_DIRECTORY",
    });
  });

  it("fails for duplicate restaurant slugs", async () => {
    const root = await createRoot();
    await writeRestaurant(root, "one", "duplicate");
    await writeRestaurant(root, "two", "duplicate");

    await expect(discoverRestaurants(root)).rejects.toMatchObject({
      code: "DUPLICATE_RESTAURANT_SLUG",
      slug: "duplicate",
    });
  });

  it("fails for an incomplete visible restaurant directory", async () => {
    const root = await createRoot();
    const directory = join(root, "incomplete");
    await mkdir(directory);
    await writeFile(
      join(directory, "restaurant.json"),
      JSON.stringify(restaurantConfiguration("incomplete")),
      "utf8",
    );

    await expect(discoverRestaurants(root)).rejects.toMatchObject({
      code: "INCOMPLETE_RESTAURANT_DIRECTORY",
      path: directory,
    });
  });

  it("wraps configuration and asset failures from a discovered restaurant", async () => {
    const root = await createRoot();
    await writeRestaurant(root, "invalid");
    await writeFile(join(root, "invalid", "restaurant.json"), "{}", "utf8");

    const error = await discoverRestaurants(root).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RestaurantDiscoveryError);
    expect(error).toMatchObject({ code: "INVALID_RESTAURANT_SOURCE" });
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it("builds the checked-in second restaurant model", async () => {
    const restaurantsRoot = fileURLToPath(
      new URL("../../../restaurants", import.meta.url),
    );

    const restaurants = await discoverRestaurants(restaurantsRoot);
    const cafe = restaurants.find(
      (restaurant) => restaurant.model.restaurant.slug === "demo-cafe",
    );

    expect(cafe?.model.restaurant.name).toBe("Demo Cafe");
    expect(cafe?.model.menu.sections.map((section) => section.id)).toEqual([
      "coffee",
      "breakfast",
    ]);
    expect(cafe?.model.assets.restaurant.logo?.publicPath).toBe(
      "/assets/demo-cafe/logo.svg",
    );
  });
});

describe("getRestaurantRoutePath", () => {
  it("derives a trailing-slash route from a validated slug", () => {
    expect(getRestaurantRoutePath("demo-cafe")).toBe("/demo-cafe/");
  });
});
