import { cache } from "react";
import { getEnabledFeatures } from "@/lib/api";

const getFeatureSet = cache(async () => {
  return new Set(await getEnabledFeatures());
});

export async function hasServerFeature(slug: string): Promise<boolean> {
  const features = await getFeatureSet();
  return features.has(slug);
}
