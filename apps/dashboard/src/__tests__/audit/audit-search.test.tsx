import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@appranks/shared", () => ({
  PLATFORMS: { shopify: { id: "shopify", name: "Shopify" } },
  isPlatformId: (id: string) => id === "shopify",
}));

const { AuditSearch } = await import("@/components/audit/audit-search");

describe("AuditSearch", () => {
  it("renders search input and button", () => {
    render(<AuditSearch />);
    expect(screen.getByPlaceholderText("Search your app by name...")).toBeDefined();
    expect(screen.getByText("Audit Now")).toBeDefined();
  });

  it("button is disabled initially", () => {
    render(<AuditSearch />);
    const button = screen.getByText("Audit Now");
    expect(button).toHaveProperty("disabled", true);
  });
});
