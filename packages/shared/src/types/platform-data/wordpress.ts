/** Platform-specific data for WordPress Plugin Directory. */
export interface WordPressPlatformData {
  shortDescription?: string;
  version?: string;
  testedUpTo?: string;
  requiresWP?: string;
  requiresPHP?: string;
  activeInstalls?: number;
  downloaded?: number;
  lastUpdated?: string;
  added?: string;
  contributors?: Record<string, unknown>;
  tags?: Record<string, string>;
  supportThreads?: number;
  supportThreadsResolved?: number;
  homepage?: string;
  donateLink?: string;
  description?: string;
  faq?: string;
  changelog?: string;
  screenshots?: Record<string, unknown>;
  banners?: Record<string, string>;
  businessModel?: string;
  ratings?: Record<string, number>;
}
