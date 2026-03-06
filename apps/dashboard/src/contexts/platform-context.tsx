"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { PLATFORMS, type PlatformId, type PlatformConfig } from "@appranks/shared";

interface PlatformContextValue {
  platform: PlatformConfig;
  platformId: PlatformId;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({
  platformId,
  children,
}: {
  platformId: PlatformId;
  children: ReactNode;
}) {
  const platform = PLATFORMS[platformId];
  return (
    <PlatformContext.Provider value={{ platform, platformId }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return context;
}

/**
 * Like usePlatform but returns null if outside provider.
 * Useful for components that may render outside platform routes (settings, system-admin).
 */
export function usePlatformOptional(): PlatformContextValue | null {
  return useContext(PlatformContext);
}
