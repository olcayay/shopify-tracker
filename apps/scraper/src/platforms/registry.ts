import type { PlatformId } from "@appranks/shared";
import type { PlatformModule } from "./platform-module.js";
import { ShopifyModule } from "./shopify/index.js";
import { SalesforceModule } from "./salesforce/index.js";
import type { HttpClient } from "../http-client.js";

const moduleCache = new Map<PlatformId, PlatformModule>();

export function getModule(platformId: PlatformId, httpClient?: HttpClient): PlatformModule {
  const cached = moduleCache.get(platformId);
  if (cached) return cached;

  let module: PlatformModule;

  switch (platformId) {
    case "shopify":
      module = new ShopifyModule(httpClient);
      break;
    case "salesforce":
      module = new SalesforceModule(httpClient);
      break;
    case "canva":
      throw new Error(`Platform module "${platformId}" not yet implemented`);
    default:
      throw new Error(`Unknown platform: ${platformId}`);
  }

  moduleCache.set(platformId, module);
  return module;
}

/** Clear the module cache (useful for testing) */
export function clearModuleCache(): void {
  moduleCache.clear();
}
