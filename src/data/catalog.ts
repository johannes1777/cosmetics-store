import { supabase } from "../lib/supabase";
import { publicImageUrl } from "../lib/storage";
import type { Category, Product, ProductPhoto } from "../types";

export type DeliverySettings = { standardPence: number; freeOverPence: number };
export type Catalog = { categories: Category[]; products: Product[]; delivery: DeliverySettings };

type VariantRow = { id: string; label: string; swatch: string | null; stock: number; sort_order: number };
type ProductRow = {
  id: string; slug: string; name: string; category_id: string;
  short_description: string; description: string; price_pence: number;
  option_name: string; featured: boolean; active: boolean; tone: string;
  product_variants: VariantRow[];
};
type PhotoRow = { id: string; product_id: string; path: string; alt: string; position: number };
type CategoryRow = { id: string; name: string; blurb: string; tone: string };

// Turns a database row (snake_case) into the shape the pages use.
export function mapProduct(row: ProductRow, images: ProductPhoto[] = []): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryId: row.category_id,
    shortDescription: row.short_description,
    description: row.description,
    pricePence: row.price_pence,
    optionName: row.option_name,
    featured: row.featured,
    active: row.active,
    tone: row.tone,
    images,
    variants: [...(row.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, label: v.label, stock: v.stock, swatch: v.swatch ?? undefined })),
  };
}

// Loads everything the public shop needs. We ask for active products only; the database
// rules already hide inactive ones from shoppers, but a signed-in admin could otherwise
// see hidden products in the public shop.
export async function fetchCatalog(): Promise<Catalog> {
  if (!supabase) throw new Error("NOT_CONFIGURED");
  const [cats, prods, settings, photos] = await Promise.all([
    supabase.from("categories").select("id, name, blurb, tone").order("sort_order"),
    supabase.from("products").select("*, product_variants(*)").eq("active", true).order("created_at"),
    supabase.from("store_settings").select("delivery_standard_pence, delivery_free_over_pence").eq("id", true).single(),
    // Photos are optional: if the photos table does not exist yet (004 not applied), the shop
    // simply shows the drawn placeholders instead of failing.
    supabase.from("product_images").select("id, product_id, path, alt, position").order("position"),
  ]);
  if (cats.error) throw new Error(cats.error.message);
  if (prods.error) throw new Error(prods.error.message);
  if (settings.error) throw new Error(settings.error.message);

  const photosByProduct = new Map<string, ProductPhoto[]>();
  if (!photos.error) {
    for (const ph of (photos.data ?? []) as unknown as PhotoRow[]) {
      const list = photosByProduct.get(ph.product_id) ?? [];
      list.push({ id: ph.id, url: publicImageUrl(ph.path), alt: ph.alt });
      photosByProduct.set(ph.product_id, list);
    }
  }

  return {
    categories: ((cats.data ?? []) as unknown as CategoryRow[]).map((c) => ({ id: c.id, name: c.name, blurb: c.blurb, tone: c.tone })),
    products: ((prods.data ?? []) as unknown as ProductRow[]).map((row) => mapProduct(row, photosByProduct.get(row.id) ?? [])),
    delivery: {
      standardPence: settings.data.delivery_standard_pence as number,
      freeOverPence: settings.data.delivery_free_over_pence as number,
    },
  };
}

export const totalStock = (p: Product) => p.variants.reduce((sum, v) => sum + v.stock, 0);
