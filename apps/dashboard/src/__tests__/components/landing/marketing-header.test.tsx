import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Mock Sheet
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe("MarketingHeader - unauthenticated", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: null,
        isLoading: false,
      }),
    }));
  });

  it("renders AppRanks brand", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    expect(screen.getByText("AppRanks")).toBeInTheDocument();
  });

  it("renders Sign In and Get Started links when not authenticated", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("Sign In links to /login", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    const link = screen.getByText("Sign In").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("Get Started links to /register", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    const link = screen.getByText("Get Started").closest("a");
    expect(link).toHaveAttribute("href", "/register");
  });

  it("logo links to /", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    const link = screen.getByText("AppRanks").closest("a");
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders as header element", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    const { container } = render(<MarketingHeader />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("has sticky positioning", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    const { container } = render(<MarketingHeader />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("sticky");
  });
});

describe("MarketingHeader - authenticated", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", name: "Test", email: "test@test.com" },
        isLoading: false,
      }),
    }));
  });

  it("shows Go to Dashboard when authenticated", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("Go to Dashboard links to /overview", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    const link = screen.getByText("Go to Dashboard").closest("a");
    expect(link).toHaveAttribute("href", "/overview");
  });

  it("does not show Sign In or Get Started when authenticated", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    expect(screen.queryByText("Sign In")).toBeNull();
    expect(screen.queryByText("Get Started")).toBeNull();
  });
});

describe("MarketingHeader - loading", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: null,
        isLoading: true,
      }),
    }));
  });

  it("shows Sign In and Get Started while loading", async () => {
    const { MarketingHeader } = await import(
      "@/components/landing/marketing-header"
    );
    render(<MarketingHeader />);
    // When loading and no user, should show unauthenticated state
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });
});
