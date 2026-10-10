export type Category = {
  id: string;
  name: string;
  blurb: string;
  tone: string; // colour used by the placeholder artwork
};

export type Variant = {
  id: string;
  label: string; // e.g. "Rosewood" or "50 ml"
  stock: number;
  swatch?: string; // optional colour dot for shades
};

export type ProductPhoto = { id: string; url: string; alt: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  pricePence: number; // money is stored in pence to avoid rounding errors
  optionName: string; // "Shade" or "Size"
  variants: Variant[];
  featured: boolean;
  active: boolean;
  tone: string;
  images: ProductPhoto[]; // real photos; when empty the drawn placeholder is shown
};

export type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
};

export type CartLine = {
  key: string;
  product: Product;
  variant: Variant;
  quantity: number;
  linePence: number;
};

export type CustomerDetails = {
  fullName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
};

export type Order = {
  reference: string;
  createdAt: string;
  customer: CustomerDetails;
  lines: { name: string; option: string; quantity: number; linePence: number }[];
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
};

// ---------- Editable storefront content ----------
export type PageKey = "about" | "contact" | "delivery" | "returns" | "privacy";
export type SectionKey = "hero" | "categories" | "featured" | "promise";

export type SiteContent = {
  heroHeadline: string;
  heroText: string;
  heroButtonLabel: string;
  heroButtonLink: string;
  heroImagePath: string | null;
  heroImageAlt: string;
  contactEmail: string;
  contactPhone: string;
  contactHours: string;
  contactAddress: string; // lines separated by new lines
};

export type SitePage = {
  key: PageKey;
  title: string;
  body: string;
  imagePath: string | null;
  imageAlt: string;
};

export type HomeSection = { key: SectionKey; visible: boolean; position: number };
