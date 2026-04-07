"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";

interface FeatureFlagsContextValue {
  enabledFeatures: string[];
  hasFeature: (slug: string) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user, account } = useAuth();

  const value = useMemo<FeatureFlagsContextValue>(() => {
    // System admins get all features enabled
    if (user?.isSystemAdmin) {
      return {
        enabledFeatures: account?.enabledFeatures ?? [],
        hasFeature: () => true,
      };
    }

    const features = account?.enabledFeatures ?? [];
    const featureSet = new Set(features);

    return {
      enabledFeatures: features,
      hasFeature: (slug: string) => featureSet.has(slug),
    };
  }, [user?.isSystemAdmin, account?.enabledFeatures]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Returns feature flag state and a helper to check individual flags.
 * Must be used within FeatureFlagsProvider.
 */
export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  }
  return context;
}

/**
 * Convenience hook — returns true if the given feature flag is enabled.
 */
export function useFeatureFlag(slug: string): boolean {
  const { hasFeature } = useFeatureFlags();
  return hasFeature(slug);
}
