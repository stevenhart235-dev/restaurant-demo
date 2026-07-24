import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadMenuConfig,
  MenuConfigLoadError,
  type MenuConfigLoadErrorCode,
} from "./load-menu-config.js";

const temporaryDirectories: string[] = [];

const validMenu = {
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
        },
      ],
    },
  ],
};

async function createTemporaryRestaurant(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "menu-config-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function expectLoadError(
  promise: Promise<unknown>,
  code: MenuConfigLoadErrorCode,
): Promise<MenuConfigLoadError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(MenuConfigLoadError);
    expect(error).toMatchObject({ code });
    return error as MenuConfigLoadError;
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

describe("loadMenuConfig", () => {
  it("loads a valid temporary menu", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(
      join(directory, "menu.json"),
      JSON.stringify(validMenu),
      "utf8",
    );

    await expect(loadMenuConfig(directory)).resolves.toEqual(validMenu);
  });

  it("reports a missing restaurant directory", async () => {
    const parentDirectory = await createTemporaryRestaurant();
    const missingDirectory = join(parentDirectory, "missing");

    const error = await expectLoadError(
      loadMenuConfig(missingDirectory),
      "RESTAURANT_DIRECTORY_NOT_FOUND",
    );

    expect(error.path).toBe(missingDirectory);
  });

  it("reports a missing menu.json file", async () => {
    const directory = await createTemporaryRestaurant();

    const error = await expectLoadError(
      loadMenuConfig(directory),
      "MENU_CONFIG_NOT_FOUND",
    );

    expect(error.path).toBe(join(directory, "menu.json"));
  });

  it("reports invalid JSON", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(join(directory, "menu.json"), "{invalid", "utf8");

    const error = await expectLoadError(
      loadMenuConfig(directory),
      "INVALID_MENU_JSON",
    );

    expect(error.cause).toBeInstanceOf(SyntaxError);
  });

  it("reports schema validation failures", async () => {
    const directory = await createTemporaryRestaurant();
    await writeFile(join(directory, "menu.json"), "{}", "utf8");

    const error = await expectLoadError(
      loadMenuConfig(directory),
      "INVALID_MENU_CONFIG",
    );

    expect(error.cause).toBeDefined();
  });

  it("loads the demo-pizza menu configuration", async () => {
    const demoPizzaDirectory = fileURLToPath(
      new URL("../../../restaurants/demo-pizza", import.meta.url),
    );

    const menu = await loadMenuConfig(demoPizzaDirectory);

    expect(menu.id).toBe("main-menu");
    expect(menu.currency).toBe("USD");
  });
});
