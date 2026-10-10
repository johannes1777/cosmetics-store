// ============================================================
// EDIT THIS FILE to reuse the template for a new client.
// Everything marked PLACEHOLDER must be replaced before launch.
// ============================================================
export const storeConfig = {
  brandName: "Rosewell Cosmetics",
  tagline: "Colour and care for everyday",
  isDemo: true, // set to false to hide the demo banner and sample labels

  // --- Money ---
  currency: { code: "GBP", locale: "en-GB" },
  pricesIncludeVat: true, // UK shop prices normally include VAT

  // --- Country ---
  country: "United Kingdom",

  // --- Delivery ---
  // The delivery PRICES live in the database table store_settings (change them in the
  // Supabase Table Editor) so the server can calculate totals itself. Only the wording is here.
  delivery: {
    estimate: "2 to 4 working days",
  },

  // --- Returns ---
  returnsDays: 30,

  // --- PLACEHOLDER contact and business details ---
  contact: {
    email: "hello@example.com",
    phone: "00000 000000",
    addressLines: ["1 Placeholder Street", "Placeholder Town", "AB1 2CD"],
    openingHours: "Mon to Fri, 9am to 5pm (placeholder)",
  },
  business: {
    legalName: "Placeholder Cosmetics Ltd",
    companyNumber: "00000000",
    vatNumber: "GB 000 0000 00",
  },

  // --- Colours (used across the whole site) ---
  theme: {
    ink: "#2a1b2e",
    accent: "#b4325f",
    accentDark: "#8e234a",
    tint: "#f6eef4",
    mist: "#e9d5e4",
  },
};
