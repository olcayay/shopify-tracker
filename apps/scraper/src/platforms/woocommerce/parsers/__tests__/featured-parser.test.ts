import { describe, it, expect } from "vitest";
import { parseWooCommerceFeaturedSections } from "../featured-parser.js";
import { makeFeaturedResponse, makeEmptyFeaturedResponse } from "./fixtures.js";

describe("parseWooCommerceFeaturedSections", () => {
  it("parses featured sections", () => {
    const json = makeFeaturedResponse(2);
    const result = parseWooCommerceFeaturedSections(json);

    expect(result).toHaveLength(2);
    expect(result[0].sectionTitle).toBe("Featured Section 1");
    expect(result[0].sectionHandle).toBe("featured-section-1");
    expect(result[0].surface).toBe("homepage");
    expect(result[0].surfaceDetail).toBe("woocommerce-marketplace-homepage");
    expect(result[0].apps).toHaveLength(2);
    expect(result[0].apps[0].slug).toBe("featured-app-0-1");
    expect(result[0].apps[0].position).toBe(1);
  });

  it("returns empty for no sections", () => {
    const json = makeEmptyFeaturedResponse();
    const result = parseWooCommerceFeaturedSections(json);

    expect(result).toEqual([]);
  });

  it("filters out sections with no products", () => {
    const json = JSON.stringify({
      sections: [
        { title: "Empty Section", products: [] },
        { title: "Valid Section", products: [{ slug: "app-1", title: "App 1" }] },
      ],
    });
    const result = parseWooCommerceFeaturedSections(json);

    expect(result).toHaveLength(1);
    expect(result[0].sectionTitle).toBe("Valid Section");
  });

  it("slugifies section titles correctly", () => {
    const json = JSON.stringify({
      sections: [
        { title: "Take your store beyond the typical", products: [{ slug: "a", title: "A" }] },
      ],
    });
    const result = parseWooCommerceFeaturedSections(json);

    expect(result[0].sectionHandle).toBe("take-your-store-beyond-the-typical");
  });
});
