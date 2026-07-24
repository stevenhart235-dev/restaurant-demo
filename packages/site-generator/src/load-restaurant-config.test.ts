import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadRestaurantConfig,
  RestaurantConfigLoadError,
  type RestaurantConfigLoadErrorCode,
} from "./load-restaurant-config.js";

const temporaryDirectories: string[] = [];

const validConfiguration = {
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
};

async function createTemporaryRestaurant(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "restaurant-config-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function expectLoadError(
  promise: Promise<unknown>,
  code: RestaurantConfigLoadErrorCode,
): Promise<RestaurantConfigLoadError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RestaurantConfigLoadError);
    expect(error).toMatchObject({ code });
    return error as RestaurantConfigLoadError;
  }

  throw new Error(`Expected loader to reject with ${code}`);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("loadRestaurantConfig", () => {
  it("loads a valid restaurant configuration", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(
      join(directory, "restaurant.json"),
      JSON.stringify(validConfiguration),
      "utf8",
    );

    await expect(loadRestaurantConfig(directory)).resolves.toEqual(
      validConfiguration,
    );
  });

  it("reports a missing restaurant directory", async () => {
    const parentDirectory = await createTemporaryRestaurant();
    const missingDirectory = join(parentDirectory, "missing");

    const error = await expectLoadError(
      loadRestaurantConfig(missingDirectory),
      "RESTAURANT_DIRECTORY_NOT_FOUND",
    );

    expect(error.path).toBe(missingDirectory);
  });

  it("reports a missing restaurant.json file", async () => {
    const directory = await createTemporaryRestaurant();

    const error = await expectLoadError(
      loadRestaurantConfig(directory),
      "RESTAURANT_CONFIG_NOT_FOUND",
    );

    expect(error.path).toBe(join(directory, "restaurant.json"));
  });

  it("reports invalid JSON", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(join(directory, "restaurant.json"), "{invalid", "utf8");

    const error = await expectLoadError(
      loadRestaurantConfig(directory),
      "INVALID_RESTAURANT_JSON",
    );

    expect(error.cause).toBeInstanceOf(SyntaxError);
  });

  it("reports schema validation failures", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(join(directory, "restaurant.json"), "{}", "utf8");

    const error = await expectLoadError(
      loadRestaurantConfig(directory),
      "INVALID_RESTAURANT_CONFIG",
    );

    expect(error.cause).toBeDefined();
  });

  it("loads the demo-pizza restaurant configuration", async () => {
    const demoPizzaDirectory = fileURLToPath(
      new URL("../../../restaurants/demo-pizza", import.meta.url),
    );

    const configuration = await loadRestaurantConfig(demoPizzaDirectory);

    expect(configuration.id).toBe("demo-pizza");
    expect(configuration.slug).toBe("demo-pizza");
  });
});
