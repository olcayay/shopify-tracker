/** Platform-specific data for Canva apps. */
export interface CanvaPlatformData {
  canvaAppId?: string;
  canvaAppType?: string;
  description?: string;
  tagline?: string;
  fullDescription?: string;
  topics?: string[];
  urlSlug?: string;
  screenshots?: string[];
  promoCardUrl?: string;
  developerEmail?: string;
  developerPhone?: string;
  developerAddress?: {
    street?: string;
    city?: string;
    country?: string;
    state?: string;
    zip?: string;
  };
  termsUrl?: string;
  privacyUrl?: string;
  permissions?: { scope: string; type: "MANDATORY" | "OPTIONAL" | string }[];
  languages?: string[];
}
