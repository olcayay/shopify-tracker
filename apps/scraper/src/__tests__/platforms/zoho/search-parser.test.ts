import { describe, it, expect } from "vitest";
import { parseZohoSearchPage } from "../../../platforms/zoho/parsers/search-parser.js";

const zohoHtml = `<html><body>
<div class="default-card-wrapper">
  <a href="/app/crm/my-extension">
    <img src="/logo.png" alt="My Extension">
    <div class="f15 singleLineEllips">My Extension</div>
    <div class="secondComp"><div class="f14">Great CRM extension</div></div>
    <span class="no-rating">(42)</span>
    <a class="colorF5A623"></a><a class="colorF5A623"></a><a class="colorF5A623"></a><a class="colorF5A623"></a>
  </a>
</div>
</body></html>`;

const multiAppHtml = `<html><body>
<div class="default-card-wrapper">
  <a href="/app/crm/first-app">
    <img src="/logo1.png" alt="First App">
    <div class="f15 singleLineEllips">First App</div>
    <div class="secondComp"><div class="f14">First description</div></div>
    <span class="no-rating">(10)</span>
    <a class="colorF5A623"></a><a class="colorF5A623"></a><a class="colorF5A623"></a>
  </a>
</div>
<div class="default-card-wrapper">
  <a href="/app/desk/second-app">
    <img src="/logo2.png" alt="Second App">
    <div class="f15 singleLineEllips">Second App</div>
    <div class="secondComp"><div class="f14">Second description</div></div>
    <span class="no-rating">(25)</span>
    <a class="colorF5A623"></a><a class="colorF5A623"></a>
  </a>
</div>
<div class="default-card-wrapper">
  <a href="/app/crm/third-app">
    <img src="/logo3.png" alt="Third App">
    <div class="f15 singleLineEllips">Third App</div>
    <div class="secondComp"><div class="f14">Third description</div></div>
    <span class="no-rating">(8)</span>
    <a class="colorF5A623"></a><a class="colorF5A623"></a><a class="colorF5A623"></a><a class="colorF5A623"></a><a class="colorF5A623"></a>
  </a>
</div>
</body></html>`;

describe("parseZohoSearchPage", () => {
  it("parses search results from .default-card-wrapper cards", () => {
    const result = parseZohoSearchPage(zohoHtml, "crm", 1);
    expect(result.apps.length).toBe(1);
    expect(result.apps[0]!.appName).toBe("My Extension");
    expect(result.apps[0]!.shortDescription).toBe("Great CRM extension");
    expect(result.keyword).toBe("crm");
  });

  it("extracts slug as service--namespace from href", () => {
    const result = parseZohoSearchPage(zohoHtml, "crm", 1);
    expect(result.apps[0]!.appSlug).toBe("crm--my-extension");
  });

  it("deduplicates by slug", () => {
    const duplicateHtml = `<html><body>
      <div class="default-card-wrapper">
        <a href="/app/crm/same-app">
          <div class="f15 singleLineEllips">Same App</div>
        </a>
      </div>
      <div class="default-card-wrapper">
        <a href="/app/crm/same-app">
          <div class="f15 singleLineEllips">Same App Duplicate</div>
        </a>
      </div>
    </body></html>`;
    const result = parseZohoSearchPage(duplicateHtml, "test", 1);
    expect(result.apps.length).toBe(1);
    expect(result.apps[0]!.appSlug).toBe("crm--same-app");
  });

  it("returns empty apps for HTML without app links", () => {
    const noAppsHtml = "<html><body><p>No results found</p></body></html>";
    const result = parseZohoSearchPage(noAppsHtml, "nothing", 1);
    expect(result.apps).toEqual([]);
    expect(result.totalResults).toBeNull();
  });

  it("extracts rating count from .no-rating text", () => {
    const result = parseZohoSearchPage(zohoHtml, "crm", 1);
    expect(result.apps[0]!.ratingCount).toBe(42);
  });

  it("sets position incrementally (1, 2, 3...)", () => {
    const result = parseZohoSearchPage(multiAppHtml, "test", 1);
    expect(result.apps.length).toBe(3);
    expect(result.apps[0]!.position).toBe(1);
    expect(result.apps[1]!.position).toBe(2);
    expect(result.apps[2]!.position).toBe(3);
  });
});
