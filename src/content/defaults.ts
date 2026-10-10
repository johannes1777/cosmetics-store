import type { HomeSection, PageKey, SiteContent, SitePage } from "../types";

// Used ONLY if the database has not had 004_storefront_content.sql applied yet,
// so the shop keeps working. These match the starter text in that file.
export const defaultContent: SiteContent = {
  heroHeadline: "Find your shade. Keep your routine simple.",
  heroText: "{{brand_name}} makes lip, face, skin and body essentials in colours and formulas made for every day.",
  heroButtonLabel: "Shop all products",
  heroButtonLink: "/shop",
  heroImagePath: null,
  heroImageAlt: "",
  contactEmail: "hello@example.com",
  contactPhone: "00000 000000",
  contactHours: "Mon to Fri, 9am to 5pm (placeholder)",
  contactAddress: "1 Placeholder Street\nPlaceholder Town\nAB1 2CD",
};

const page = (key: PageKey, title: string, body: string): SitePage => ({ key, title, body, imagePath: null, imageAlt: "" });

export const defaultPages: Record<PageKey, SitePage> = {
  about: page("about", "About us", "{{brand_name}} is a sample cosmetics brand used to demonstrate this store template. Replace this page with the real story: who makes the products, what you care about, and why customers can trust you.\n\nGood about pages say where products are made, how they are tested, and what makes the range different. Keep it short and specific."),
  contact: page("contact", "Contact us", "Questions about an order or a product? Get in touch using the details below."),
  delivery: page("delivery", "Delivery", "## Where we deliver\nWe deliver to addresses in the {{country}}.\n\n## Cost and timing\n- Standard delivery costs {{delivery_price}} and takes {{delivery_estimate}}.\n- Delivery is free on orders over {{free_delivery_threshold}}.\n\nThe delivery cost is shown in your basket and at checkout before you order."),
  returns: page("returns", "Returns", "## Our returns promise\nYou can return unopened items within {{returns_days}} days of receiving them for a refund. For hygiene reasons we cannot accept opened lip, eye or skincare products unless they are faulty.\n\n## How to return an item\nEmail {{contact_email}} with your order reference and we will send you the steps.\n\n## Your legal rights\nThis does not affect your statutory rights. Add the cancellation and faulty-goods wording your business is required to show customers."),
  privacy: page("privacy", "Privacy", "## What we collect\nWhen you place an order we collect your name, email address, delivery address and, if you choose to give it, your phone number. We collect only what we need to deliver your order and contact you about it.\n\n## How we use it\nWe use your details to process and deliver orders, and to answer questions about them.\n\n## Your rights\nYou can ask to see, correct or delete the personal information we hold about you by emailing {{contact_email}}.\n\nAdd your legal business name, how long you keep data, which services process it, and how customers can complain to the Information Commissioner's Office."),
};

export const defaultSections: HomeSection[] = [
  { key: "hero", visible: true, position: 1 },
  { key: "categories", visible: true, position: 2 },
  { key: "featured", visible: true, position: 3 },
  { key: "promise", visible: true, position: 4 },
];

export const SECTION_LABELS: Record<string, string> = {
  hero: "Hero banner (headline, text, button and picture)",
  categories: "Shop by category",
  featured: "Featured products",
  promise: "Delivery and returns strip",
};

export const PAGE_LABELS: Record<PageKey, string> = {
  about: "About",
  contact: "Contact",
  delivery: "Delivery",
  returns: "Returns",
  privacy: "Privacy",
};
