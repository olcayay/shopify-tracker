/** Platform-specific data for Zendesk Marketplace apps. */
export interface ZendeskPlatformData {
  shortDescription?: string;
  longDescription?: string;
  installationInstructions?: string;
  pricing?: string;
  datePublished?: string;
  version?: string;
  categories?: { slug: string; name: string }[];
  /** Product types: support, chat, sell */
  products?: string[];
  source?: "json-ld" | "next-data" | "dom-fallback";
}
