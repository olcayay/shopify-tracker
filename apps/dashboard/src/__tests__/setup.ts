import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/overview",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => {
    const React = require("react");
    return React.createElement("a", { href, ...props }, children);
  },
}));

// Mock next/headers (server-side only)
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
  }),
}));

// Mock radix-ui (Slot, VisuallyHidden, etc.)
vi.mock("radix-ui", async (importOriginal) => {
  const React = await import("react");
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Slot: {
      Root: React.forwardRef(({ children, ...props }: any, ref: any) => {
        if (React.isValidElement(children)) {
          return React.cloneElement(children as any, { ...props, ref });
        }
        return React.createElement("span", { ...props, ref }, children);
      }),
    },
    VisuallyHidden: {
      Root: ({ children }: { children: React.ReactNode }) =>
        React.createElement("span", { style: { display: "none" } }, children),
    },
  };
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
