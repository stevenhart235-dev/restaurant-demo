import { describe, expect, it } from "vitest";

import { MenuConfigSchema } from "./menu-config.js";

const minimalMenu = {
  id: "dinner",
  name: "Dinner",
  currency: "USD",
  sections: [
    {
      id: "pizza",
      name: "Pizza",
      displayOrder: 1,
      items: [
        {
          id: "margherita",
          name: "Margherita",
          prices: [{ amount: 14.5 }],
        },
      ],
    },
  ],
} as const;

describe("MenuConfigSchema", () => {
  it("accepts a valid minimal menu", () => {
    expect(MenuConfigSchema.safeParse(minimalMenu).success).toBe(true);
  });

  it("accepts a valid complete menu", () => {
    const menu = {
      ...minimalMenu,
      description: "Our complete dinner menu.",
      effectiveDate: "2026-07-23",
      sections: [
        {
          ...minimalMenu.sections[0],
          description: "Hand-stretched pizzas.",
          items: [
            {
              ...minimalMenu.sections[0].items[0],
              description: "Tomato, mozzarella, and basil.",
              dietaryTags: ["vegetarian"],
              availability: "available",
              featured: true,
              image: "assets/menu/margherita.jpg",
            },
          ],
        },
        {
          id: "desserts",
          name: "Desserts",
          description: "A sweet finish.",
          displayOrder: 2,
          items: [
            {
              id: "gelato",
              name: "Gelato",
              description: "House-made seasonal gelato.",
              prices: [
                { name: "small", amount: 5 },
                { name: "large", amount: 8.5 },
              ],
              dietaryTags: ["vegetarian", "gluten-free"],
              availability: "unavailable",
              featured: false,
              image: "assets/menu/gelato.jpg",
            },
          ],
        },
      ],
    };

    expect(MenuConfigSchema.safeParse(menu).success).toBe(true);
  });

  it("accepts a single-price item", () => {
    expect(
      MenuConfigSchema.safeParse({
        ...minimalMenu,
        sections: [
          {
            ...minimalMenu.sections[0],
            items: [
              {
                ...minimalMenu.sections[0].items[0],
                prices: [{ amount: 12.25 }],
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a variant-price item", () => {
    expect(
      MenuConfigSchema.safeParse({
        ...minimalMenu,
        sections: [
          {
            ...minimalMenu.sections[0],
            items: [
              {
                ...minimalMenu.sections[0].items[0],
                prices: [
                  { name: "small", amount: 10 },
                  { name: "medium", amount: 12.5 },
                  { name: "large", amount: 15 },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate section ids", () => {
    const result = MenuConfigSchema.safeParse({
      ...minimalMenu,
      sections: [
        minimalMenu.sections[0],
        {
          ...minimalMenu.sections[0],
          displayOrder: 2,
          items: [
            { id: "second-item", name: "Second Item", prices: [{ amount: 5 }] },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate item ids across sections", () => {
    const result = MenuConfigSchema.safeParse({
      ...minimalMenu,
      sections: [
        minimalMenu.sections[0],
        {
          id: "desserts",
          name: "Desserts",
          displayOrder: 2,
          items: [minimalMenu.sections[0].items[0]],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate section display order", () => {
    const result = MenuConfigSchema.safeParse({
      ...minimalMenu,
      sections: [
        minimalMenu.sections[0],
        {
          id: "desserts",
          name: "Desserts",
          displayOrder: 1,
          items: [{ id: "gelato", name: "Gelato", prices: [{ amount: 5 }] }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = MenuConfigSchema.safeParse({
      ...minimalMenu,
      sections: [
        {
          ...minimalMenu.sections[0],
          items: [
            {
              ...minimalMenu.sections[0].items[0],
              prices: [{ amount: -1 }],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid currency", () => {
    expect(
      MenuConfigSchema.safeParse({ ...minimalMenu, currency: "ZZZ" }).success,
    ).toBe(false);
  });

  it("rejects an invalid asset reference", () => {
    const result = MenuConfigSchema.safeParse({
      ...minimalMenu,
      sections: [
        {
          ...minimalMenu.sections[0],
          items: [
            {
              ...minimalMenu.sections[0].items[0],
              image: "../outside.jpg",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported dietary tag", () => {
    const result = MenuConfigSchema.safeParse({
      ...minimalMenu,
      sections: [
        {
          ...minimalMenu.sections[0],
          items: [
            {
              ...minimalMenu.sections[0].items[0],
              dietaryTags: ["healthy"],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(
      MenuConfigSchema.safeParse({ ...minimalMenu, restaurantId: "demo-pizza" })
        .success,
    ).toBe(false);
  });
});
