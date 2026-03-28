/** Platform-specific data for Zoom App Marketplace apps. */
export interface ZoomPlatformData {
  description?: string;
  companyName?: string;
  worksWith?: string[];
  usage?: string;
  fedRampAuthorized?: boolean;
  essentialApp?: boolean;
  ratingStatistics?: {
    averageRating?: number;
    totalRatings?: number;
  };
}
