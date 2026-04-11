function slugifyTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFeatureCategoryPath(platform: string, categoryTitle: string): string {
  return `/${platform}/features/categories/${slugifyTitle(categoryTitle)}`;
}

export function buildFeatureSubcategoryPath(
  platform: string,
  categoryTitle: string,
  subcategoryTitle: string,
): string {
  return `/${platform}/features/category?${new URLSearchParams({
    category: categoryTitle,
    subcategory: subcategoryTitle,
  }).toString()}`;
}
