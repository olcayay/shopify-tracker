import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  AppJsonLd,
  CategoryJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
  OrganizationJsonLd,
  ComparisonJsonLd,
} from "@/components/seo/json-ld";

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent || "{}") : null;
}

describe("JSON-LD Components", () => {
  describe("AppJsonLd", () => {
    it("renders SoftwareApplication schema", () => {
      const { container } = render(
        <AppJsonLd
          name="Test App"
          url="https://appranks.io/apps/shopify/test-app"
          developer="Acme Inc"
          rating={4.5}
          ratingCount={100}
          pricingHint="Free plan available"
        />
      );
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("SoftwareApplication");
      expect(data.name).toBe("Test App");
      expect(data.author.name).toBe("Acme Inc");
      expect(data.aggregateRating.ratingValue).toBe(4.5);
      expect(data.aggregateRating.ratingCount).toBe(100);
      // PLA-1109: raw pricing strings are normalized to the canonical
      // label before emission. "Free plan available" → "Freemium".
      expect(data.offers.description).toBe("Freemium");
    });

    it("omits optional fields when not provided", () => {
      const { container } = render(
        <AppJsonLd name="Minimal App" url="https://example.com" />
      );
      const data = getJsonLd(container);
      expect(data.name).toBe("Minimal App");
      expect(data.author).toBeUndefined();
      expect(data.aggregateRating).toBeUndefined();
    });
  });

  describe("CategoryJsonLd", () => {
    it("renders ItemList schema", () => {
      const { container } = render(
        <CategoryJsonLd
          name="Marketing"
          url="https://appranks.io/categories/shopify/marketing"
          apps={[
            { name: "App1", url: "https://example.com/app1", position: 1 },
            { name: "App2", url: "https://example.com/app2", position: 2 },
          ]}
          totalApps={50}
        />
      );
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("ItemList");
      expect(data.numberOfItems).toBe(50);
      expect(data.itemListElement).toHaveLength(2);
      expect(data.itemListElement[0].position).toBe(1);
    });
  });

  describe("BreadcrumbJsonLd", () => {
    it("renders BreadcrumbList schema", () => {
      const { container } = render(
        <BreadcrumbJsonLd
          items={[
            { name: "Home", url: "https://appranks.io" },
            { name: "Shopify", url: "https://appranks.io/shopify" },
          ]}
        />
      );
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("BreadcrumbList");
      expect(data.itemListElement).toHaveLength(2);
      expect(data.itemListElement[0].position).toBe(1);
      expect(data.itemListElement[1].position).toBe(2);
    });
  });

  describe("FaqJsonLd", () => {
    it("renders FAQPage schema", () => {
      const { container } = render(
        <FaqJsonLd
          questions={[
            { question: "What is AppRanks?", answer: "A marketplace analytics tool." },
          ]}
        />
      );
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("FAQPage");
      expect(data.mainEntity[0]["@type"]).toBe("Question");
      expect(data.mainEntity[0].acceptedAnswer.text).toBe("A marketplace analytics tool.");
    });
  });

  describe("OrganizationJsonLd", () => {
    it("renders Organization schema with defaults", () => {
      const { container } = render(<OrganizationJsonLd />);
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("Organization");
      expect(data.name).toBe("AppRanks");
      expect(data.url).toBe("https://appranks.io");
    });
  });

  describe("ComparisonJsonLd", () => {
    it("renders Article schema with compared apps", () => {
      const { container } = render(
        <ComparisonJsonLd
          headline="App1 vs App2"
          url="https://appranks.io/compare/shopify/app1-vs-app2"
          apps={[
            { name: "App1", url: "https://example.com/app1" },
            { name: "App2", url: "https://example.com/app2" },
          ]}
        />
      );
      const data = getJsonLd(container);
      expect(data["@type"]).toBe("Article");
      expect(data.headline).toBe("App1 vs App2");
      expect(data.about).toHaveLength(2);
    });
  });
});
