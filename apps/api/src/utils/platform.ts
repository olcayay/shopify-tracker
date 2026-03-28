import { PLATFORMS, type PlatformId } from "@appranks/shared";

export function getPlatformFromQuery(query: Record<string, unknown>): PlatformId {
  const platform = (query?.platform as string) || "shopify";
  if (!(platform in PLATFORMS)) {
    throw { statusCode: 400, message: `Invalid platform: ${platform}` };
  }
  return platform as PlatformId;
}

export function requireCapability(platform: PlatformId, capability: keyof typeof PLATFORMS["shopify"]): void {
  const config = PLATFORMS[platform];
  if (!config[capability]) {
    throw { statusCode: 400, message: `${capability} is not available for ${config.name}` };
  }
}
