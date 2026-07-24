import { describe, expect, it } from "vitest";

import {
  formatBusinessHours,
  formatCurrency,
  formatLabel,
} from "./presentation.js";

describe("storefront presentation helpers", () => {
  it("formats currency amounts using the menu currency", () => {
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
  });

  it("formats open and closed business hours", () => {
    expect(
      formatBusinessHours({
        day: "friday",
        closed: false,
        open: "11:00",
        close: "22:00",
      }),
    ).toBe("11:00 AM–10:00 PM");
    expect(
      formatBusinessHours({
        day: "monday",
        closed: true,
      }),
    ).toBe("Closed");
  });

  it("formats canonical identifiers as readable labels", () => {
    expect(formatLabel("gluten-free")).toBe("Gluten Free");
    expect(formatLabel("instagram")).toBe("Instagram");
  });
});
