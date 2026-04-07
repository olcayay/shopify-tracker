import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock auth context with configurable user/account
const mockAuth = {
  user: { isSystemAdmin: false } as any,
  account: { enabledFeatures: ["market-research"] } as any,
};

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockAuth,
}));

import {
  FeatureFlagsProvider,
  useFeatureFlags,
  useFeatureFlag,
} from "../../contexts/feature-flags-context";

function FlagsConsumer() {
  const { enabledFeatures, hasFeature } = useFeatureFlags();
  return (
    <div>
      <span data-testid="features">{enabledFeatures.join(",")}</span>
      <span data-testid="has-research">{String(hasFeature("market-research"))}</span>
      <span data-testid="has-other">{String(hasFeature("other-feature"))}</span>
    </div>
  );
}

function SingleFlagConsumer({ slug }: { slug: string }) {
  const enabled = useFeatureFlag(slug);
  return <span data-testid="flag">{String(enabled)}</span>;
}

describe("FeatureFlagsProvider", () => {
  it("renders children", () => {
    render(
      <FeatureFlagsProvider>
        <span data-testid="child">Hello</span>
      </FeatureFlagsProvider>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });
});

describe("useFeatureFlags", () => {
  it("returns enabled features from account", () => {
    mockAuth.user = { isSystemAdmin: false };
    mockAuth.account = { enabledFeatures: ["market-research"] };

    render(
      <FeatureFlagsProvider>
        <FlagsConsumer />
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId("features")).toHaveTextContent("market-research");
    expect(screen.getByTestId("has-research")).toHaveTextContent("true");
    expect(screen.getByTestId("has-other")).toHaveTextContent("false");
  });

  it("returns true for all flags when user is system admin", () => {
    mockAuth.user = { isSystemAdmin: true };
    mockAuth.account = { enabledFeatures: ["market-research"] };

    render(
      <FeatureFlagsProvider>
        <FlagsConsumer />
      </FeatureFlagsProvider>
    );

    // System admin hasFeature always returns true
    expect(screen.getByTestId("has-research")).toHaveTextContent("true");
    expect(screen.getByTestId("has-other")).toHaveTextContent("true");
  });

  it("handles empty features gracefully", () => {
    mockAuth.user = { isSystemAdmin: false };
    mockAuth.account = { enabledFeatures: [] };

    render(
      <FeatureFlagsProvider>
        <FlagsConsumer />
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId("features")).toHaveTextContent("");
    expect(screen.getByTestId("has-research")).toHaveTextContent("false");
  });

  it("handles null account gracefully", () => {
    mockAuth.user = null;
    mockAuth.account = null;

    render(
      <FeatureFlagsProvider>
        <FlagsConsumer />
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId("features")).toHaveTextContent("");
    expect(screen.getByTestId("has-research")).toHaveTextContent("false");
  });

  it("throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<FlagsConsumer />)).toThrow(
      "useFeatureFlags must be used within a FeatureFlagsProvider"
    );
    spy.mockRestore();
  });
});

describe("useFeatureFlag", () => {
  it("returns true for enabled flag", () => {
    mockAuth.user = { isSystemAdmin: false };
    mockAuth.account = { enabledFeatures: ["market-research"] };

    render(
      <FeatureFlagsProvider>
        <SingleFlagConsumer slug="market-research" />
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId("flag")).toHaveTextContent("true");
  });

  it("returns false for disabled flag", () => {
    mockAuth.user = { isSystemAdmin: false };
    mockAuth.account = { enabledFeatures: [] };

    render(
      <FeatureFlagsProvider>
        <SingleFlagConsumer slug="market-research" />
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId("flag")).toHaveTextContent("false");
  });
});
