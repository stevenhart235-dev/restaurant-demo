import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const themeIdentifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const nonEmptyStringSchema = z.string().trim().min(1);
const httpUrlSchema = z
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "URL must use HTTP or HTTPS");

const assetReferenceSchema = nonEmptyStringSchema.refine((value) => {
  if (!value.startsWith("assets/") || value.includes("\\")) {
    return false;
  }

  return value
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}, "Asset reference must be a relative path below assets/");

const businessDaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const openBusinessDaySchema = z.strictObject({
  day: businessDaySchema,
  closed: z.literal(false),
  open: z
    .string()
    .regex(timePattern, "Open time must use 24-hour HH:mm format"),
  close: z
    .string()
    .regex(timePattern, "Close time must use 24-hour HH:mm format"),
});

const closedBusinessDaySchema = z.strictObject({
  day: businessDaySchema,
  closed: z.literal(true),
});

const businessHoursSchema = z
  .array(
    z.discriminatedUnion("closed", [
      openBusinessDaySchema,
      closedBusinessDaySchema,
    ]),
  )
  .min(1)
  .max(7)
  .superRefine((entries, context) => {
    const seenDays = new Set<string>();

    entries.forEach((entry, index) => {
      if (seenDays.has(entry.day)) {
        context.addIssue({
          code: "custom",
          message: `Business day "${entry.day}" must be unique`,
          path: [index, "day"],
        });
      }

      seenDays.add(entry.day);
    });
  });

const addressSchema = z.strictObject({
  street: nonEmptyStringSchema,
  street2: nonEmptyStringSchema.optional(),
  city: nonEmptyStringSchema,
  region: nonEmptyStringSchema,
  postalCode: nonEmptyStringSchema,
  country: nonEmptyStringSchema,
});

const socialLinksSchema = z.strictObject({
  facebook: httpUrlSchema.optional(),
  instagram: httpUrlSchema.optional(),
  tiktok: httpUrlSchema.optional(),
  x: httpUrlSchema.optional(),
  youtube: httpUrlSchema.optional(),
});

const brandColorsSchema = z.strictObject({
  primary: z
    .string()
    .regex(hexColorPattern, "Primary color must be a six-digit hex color"),
  secondary: z
    .string()
    .regex(hexColorPattern, "Secondary color must be a six-digit hex color")
    .optional(),
  accent: z
    .string()
    .regex(hexColorPattern, "Accent color must be a six-digit hex color")
    .optional(),
});

const assetsSchema = z.strictObject({
  logo: assetReferenceSchema.optional(),
  heroImage: assetReferenceSchema.optional(),
});

export const RestaurantConfigSchema = z.strictObject({
  id: nonEmptyStringSchema,
  slug: z
    .string()
    .min(1)
    .regex(
      slugPattern,
      "Slug must contain lowercase letters, numbers, and single hyphens",
    ),
  name: nonEmptyStringSchema,
  tagline: nonEmptyStringSchema.optional(),
  description: nonEmptyStringSchema.optional(),
  phone: nonEmptyStringSchema,
  email: z.email().optional(),
  address: addressSchema,
  businessHours: businessHoursSchema,
  socialLinks: socialLinksSchema.optional(),
  orderingLink: httpUrlSchema.optional(),
  theme: z
    .string()
    .min(1)
    .regex(
      themeIdentifierPattern,
      "Theme identifier must start with a lowercase letter and use letters, numbers, and hyphens",
    ),
  brandColors: brandColorsSchema,
  assets: assetsSchema.optional(),
});

export type RestaurantConfig = z.infer<typeof RestaurantConfigSchema>;
