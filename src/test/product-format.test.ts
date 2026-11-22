import { describe, expect, it } from "vitest";

import { formatPrice } from "@/lib/product-format";

describe("formatPrice", () => {
  it("formats prices in Thai baht", () => {
    expect(formatPrice(1250)).toBe("฿1,250.00");
  });
});