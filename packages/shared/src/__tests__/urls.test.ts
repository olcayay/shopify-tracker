import { describe, it, expect } from "vitest";
import { urls } from "../constants/urls.js";

describe("urls", () => {
  const BASE = "https://apps.shopify.com";

  it("base is correct", () => {
    expect(urls.base).toBe(BASE);
  });

  it("home() returns base URL", () => {
    expect(urls.home()).toBe(BASE);
  });

  it('app("formful") returns correct URL', () => {
    expect(urls.app("formful")).toBe(`${BASE}/formful`);
  });

  describe("appReviews", () => {
    it('defaults to page 1 for appReviews("formful")', () => {
      expect(urls.appReviews("formful")).toBe(
        `${BASE}/formful/reviews?sort_by=newest&page=1`,
      );
    });

    it('appReviews("formful", 3) includes page=3', () => {
      expect(urls.appReviews("formful", 3)).toBe(
        `${BASE}/formful/reviews?sort_by=newest&page=3`,
      );
    });
  });

  describe("category", () => {
    it('category("store-design") returns correct URL', () => {
      expect(urls.category("store-design")).toBe(
        `${BASE}/categories/store-design`,
      );
    });
  });

  describe("categoryPage", () => {
    it('categoryPage("store-design") returns URL without page param', () => {
      expect(urls.categoryPage("store-design")).toBe(
        `${BASE}/categories/store-design`,
      );
    });

    it('categoryPage("store-design", 2) includes ?page=2', () => {
      expect(urls.categoryPage("store-design", 2)).toBe(
        `${BASE}/categories/store-design?page=2`,
      );
    });

    it('categoryPage("store-design", 1) returns URL without page param', () => {
      expect(urls.categoryPage("store-design", 1)).toBe(
        `${BASE}/categories/store-design`,
      );
    });
  });

  describe("categoryAll", () => {
    it('categoryAll("store-design") returns /all URL without page param', () => {
      expect(urls.categoryAll("store-design")).toBe(
        `${BASE}/categories/store-design/all`,
      );
    });

    it('categoryAll("store-design", 2) includes ?page=2', () => {
      expect(urls.categoryAll("store-design", 2)).toBe(
        `${BASE}/categories/store-design/all?page=2`,
      );
    });
  });

  describe("search", () => {
    it('search("form") encodes keyword and defaults to page 1', () => {
      expect(urls.search("form")).toBe(
        `${BASE}/search?q=form&st_source=autocomplete&page=1`,
      );
    });

    it('search("form builder", 2) encodes spaces and includes page 2', () => {
      expect(urls.search("form builder", 2)).toBe(
        `${BASE}/search?q=form%20builder&st_source=autocomplete&page=2`,
      );
    });
  });

  describe("autocomplete", () => {
    it('autocomplete("form") returns correct URL with encoded keyword', () => {
      expect(urls.autocomplete("form")).toBe(
        `${BASE}/search/autocomplete?q=form`,
      );
    });

    it("autocomplete encodes special characters", () => {
      expect(urls.autocomplete("form builder")).toBe(
        `${BASE}/search/autocomplete?q=form%20builder`,
      );
    });
  });
});
