import { describe, expect, it } from "vitest";

import { RestaurantConfigSchema } from "./restaurant-config.js";

const minimalConfiguration = {
  id: "example-restaurant",
  slug: "example-restaurant",
  name: "Example Restaurant",
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
} as const;

describe("RestaurantConfigSchema", () => {
  it("accepts a complete restaurant configuration", () => {
    const configuration = {
      ...minimalConfiguration,
      tagline: "Dinner worth sharing",
      description: "A neighborhood restaurant serving seasonal food.",
      email: "hello@example.com",
      address: {
        ...minimalConfiguration.address,
        street2: "Suite 200",
      },
      businessHours: [
        ...minimalConfiguration.businessHours,
        {
          day: "tuesday",
          closed: true,
        },
      ],
      socialLinks: {
        facebook: "https://www.facebook.com/example",
        instagram: "https://www.instagram.com/example",
        tiktok: "https://www.tiktok.com/@example",
        x: "https://x.com/example",
        youtube: "https://www.youtube.com/@example",
      },
      orderingLink: "https://order.example.com",
      brandColors: {
        primary: "#123ABC",
        secondary: "#FEDCBA",
        accent: "#00AA44",
      },
      assets: {
        logo: "assets/logo.svg",
        heroImage: "assets/images/hero.jpg",
      },
    };

    expect(RestaurantConfigSchema.safeParse(configuration).success).toBe(true);
  });

  it("accepts a minimal restaurant configuration", () => {
    expect(RestaurantConfigSchema.safeParse(minimalConfiguration).success).toBe(
      true,
    );
  });

  it("rejects an invalid slug", () => {
    const result = RestaurantConfigSchema.safeParse({
      ...minimalConfiguration,
      slug: "Invalid Slug",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = RestaurantConfigSchema.safeParse({
      ...minimalConfiguration,
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid URL", () => {
    const result = RestaurantConfigSchema.safeParse({
      ...minimalConfiguration,
      orderingLink: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid brand color", () => {
    const result = RestaurantConfigSchema.safeParse({
      ...minimalConfiguration,
      brandColors: {
        primary: "blue",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing required values", () => {
    const configurationWithoutName = Object.fromEntries(
      Object.entries(minimalConfiguration).filter(([key]) => key !== "name"),
    );

    expect(
      RestaurantConfigSchema.safeParse(configurationWithoutName).success,
    ).toBe(false);
  });

  it("rejects duplicate and non-normalized business day keys", () => {
    const duplicateResult = RestaurantConfigSchema.safeParse({
      ...minimalConfiguration,
      businessHours: [
        minimalConfiguration.businessHours[0],
        minimalConfiguration.businessHours[0],
      ],
    });
    const nonNormalizedResult = RestaurantConfigSchema.safeParse({
      ...minimalConfiguration,
      businessHours: [
        {
          day: "Monday",
          closed: true,
        },
      ],
    });

    expect(duplicateResult.success).toBe(false);
    expect(nonNormalizedResult.success).toBe(false);
  });
});
