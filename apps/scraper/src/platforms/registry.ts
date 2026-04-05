import type { PlatformId } from "@appranks/shared";
import type { PlatformModule } from "./platform-module.js";
import { ShopifyModule } from "./shopify/index.js";
import { SalesforceModule } from "./salesforce/index.js";
import { CanvaModule } from "./canva/index.js";
import { WixModule } from "./wix/index.js";
import { WordPressModule } from "./wordpress/index.js";
import { GoogleWorkspaceModule } from "./google-workspace/index.js";
import { AtlassianModule } from "./atlassian/index.js";
import { ZoomModule } from "./zoom/index.js";
import { ZohoModule } from "./zoho/index.js";
import { ZendeskModule } from "./zendesk/index.js";
import { HubSpotModule } from "./hubspot/index.js";
import { WooCommerceModule } from "./woocommerce/index.js";
import type { HttpClient } from "../http-client.js";
import type { BrowserClient } from "../browser-client.js";
import type { FallbackTracker } from "../utils/fallback-tracker.js";

const moduleCache = new Map<PlatformId, PlatformModule>();

export function getModule(platformId: PlatformId, httpClient?: HttpClient, browserClient?: BrowserClient, tracker?: FallbackTracker): PlatformModule {
  // Skip cache when browserClient is provided (ensures it's wired correctly)
  if (!browserClient) {
    const cached = moduleCache.get(platformId);
    if (cached) return cached;
  }

  let module: PlatformModule;

  switch (platformId) {
    case "shopify":
      module = new ShopifyModule(httpClient, browserClient, tracker);
      break;
    case "salesforce":
      module = new SalesforceModule(httpClient, browserClient, tracker);
      break;
    case "canva":
      module = new CanvaModule(httpClient, browserClient, tracker);
      break;
    case "wix":
      module = new WixModule(httpClient, browserClient, tracker);
      break;
    case "wordpress":
      module = new WordPressModule(httpClient, browserClient, tracker);
      break;
    case "google_workspace":
      module = new GoogleWorkspaceModule(httpClient, browserClient, tracker);
      break;
    case "atlassian":
      module = new AtlassianModule(httpClient, browserClient, tracker);
      break;
    case "zoom":
      module = new ZoomModule(httpClient, browserClient, tracker);
      break;
    case "zoho":
      module = new ZohoModule(httpClient, browserClient, tracker);
      break;
    case "zendesk":
      module = new ZendeskModule(httpClient, browserClient, tracker);
      break;
    case "hubspot":
      module = new HubSpotModule(httpClient, browserClient, tracker);
      break;
    case "woocommerce":
      module = new WooCommerceModule(httpClient, browserClient, tracker);
      break;
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
