import type { MenuConfig, RestaurantConfig } from "@restaurant-platform/shared";

import { loadMenuConfig } from "./load-menu-config.js";
import { loadRestaurantConfig } from "./load-restaurant-config.js";

type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Property in keyof T]: DeepReadonly<T[Property]> }
      : T;

export interface SiteModel {
  readonly restaurant: DeepReadonly<RestaurantConfig>;
  readonly menu: DeepReadonly<MenuConfig>;
  readonly metadata: Readonly<{
    pageTitle: string;
    pageDescription: string;
  }>;
  readonly contact: Readonly<{
    phone: RestaurantConfig["phone"];
    email: RestaurantConfig["email"];
    address: DeepReadonly<RestaurantConfig["address"]>;
  }>;
  readonly branding: Readonly<{
    theme: RestaurantConfig["theme"];
    colors: DeepReadonly<RestaurantConfig["brandColors"]>;
    assets: DeepReadonly<RestaurantConfig["assets"]>;
  }>;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== "object") {
    return value as DeepReadonly<T>;
  }

  for (const propertyName of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value, propertyName));
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

export async function buildSiteModel(
  restaurantDirectoryPath: string,
): Promise<SiteModel> {
  const restaurant = await loadRestaurantConfig(restaurantDirectoryPath);
  const menu = await loadMenuConfig(restaurantDirectoryPath);

  return deepFreeze({
    restaurant,
    menu,
    metadata: {
      pageTitle: restaurant.tagline
        ? `${restaurant.name} | ${restaurant.tagline}`
        : restaurant.name,
      pageDescription:
        restaurant.description ?? restaurant.tagline ?? restaurant.name,
    },
    contact: {
      phone: restaurant.phone,
      email: restaurant.email,
      address: restaurant.address,
    },
    branding: {
      theme: restaurant.theme,
      colors: restaurant.brandColors,
      assets: restaurant.assets,
    },
  });
}
