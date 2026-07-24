import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const supportedCurrencyCodes = new Set(Intl.supportedValuesOf("currency"));

const assetReferenceSchema = nonEmptyStringSchema.refine((value) => {
  if (!value.startsWith("assets/") || value.includes("\\")) {
    return false;
  }

  return value
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}, "Asset reference must be a relative path below assets/");

const amountSchema = z.number().finite().nonnegative();

const singlePriceSchema = z
  .array(
    z.strictObject({
      amount: amountSchema,
    }),
  )
  .length(1);

const variantPricesSchema = z
  .array(
    z.strictObject({
      name: nonEmptyStringSchema,
      amount: amountSchema,
    }),
  )
  .min(1)
  .superRefine((prices, context) => {
    const seenNames = new Set<string>();

    prices.forEach((price, index) => {
      const normalizedName = price.name.toLocaleLowerCase("en-US");

      if (seenNames.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          message: `Price variant name "${price.name}" must be unique`,
          path: [index, "name"],
        });
      }

      seenNames.add(normalizedName);
    });
  });

const pricesSchema = z.union([singlePriceSchema, variantPricesSchema]);

const dietaryTagSchema = z.enum([
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
  "spicy",
]);

const menuItemSchema = z.strictObject({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema.optional(),
  prices: pricesSchema,
  dietaryTags: z.array(dietaryTagSchema).min(1).optional(),
  availability: z.enum(["available", "unavailable"]).optional(),
  featured: z.boolean().optional(),
  image: assetReferenceSchema.optional(),
});

const menuSectionSchema = z.strictObject({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema.optional(),
  displayOrder: z.number().int().nonnegative(),
  items: z.array(menuItemSchema).min(1),
});

export const MenuConfigSchema = z
  .strictObject({
    id: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    description: nonEmptyStringSchema.optional(),
    effectiveDate: z.iso.date().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency must be a three-letter uppercase ISO code")
      .refine(
        (currency) => supportedCurrencyCodes.has(currency),
        "Currency must be a valid ISO 4217 code",
      ),
    sections: z.array(menuSectionSchema).min(1),
  })
  .superRefine((menu, context) => {
    const seenSectionIds = new Set<string>();
    const seenItemIds = new Set<string>();
    const seenDisplayOrders = new Set<number>();

    menu.sections.forEach((section, sectionIndex) => {
      if (seenSectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: `Section id "${section.id}" must be unique`,
          path: ["sections", sectionIndex, "id"],
        });
      }

      if (seenDisplayOrders.has(section.displayOrder)) {
        context.addIssue({
          code: "custom",
          message: `Section display order "${section.displayOrder}" must be unique`,
          path: ["sections", sectionIndex, "displayOrder"],
        });
      }

      seenSectionIds.add(section.id);
      seenDisplayOrders.add(section.displayOrder);

      section.items.forEach((item, itemIndex) => {
        if (seenItemIds.has(item.id)) {
          context.addIssue({
            code: "custom",
            message: `Item id "${item.id}" must be unique across the menu`,
            path: ["sections", sectionIndex, "items", itemIndex, "id"],
          });
        }

        seenItemIds.add(item.id);
      });
    });
  });

export type MenuConfig = z.infer<typeof MenuConfigSchema>;
