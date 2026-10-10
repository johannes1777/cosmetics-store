import { storeConfig } from "../config/store";
import { useCatalog } from "../context/CatalogContext";
import { useSiteContent } from "../context/SiteContentContext";
import { formatMoney } from "../utils/format";

// Words an owner can type in {{double braces}}. They are swapped for the current value,
// so the delivery page never goes out of date when delivery prices change.
export const TOKEN_HELP: { token: string; meaning: string }[] = [
  { token: "{{brand_name}}", meaning: "your shop name" },
  { token: "{{country}}", meaning: "the country you deliver to" },
  { token: "{{delivery_price}}", meaning: "the standard delivery price" },
  { token: "{{free_delivery_threshold}}", meaning: "the spend that unlocks free delivery" },
  { token: "{{delivery_estimate}}", meaning: "the delivery time wording" },
  { token: "{{returns_days}}", meaning: "the number of days customers can return items" },
  { token: "{{contact_email}}", meaning: "your contact email address" },
];

export function useContentTokens(): Record<string, string> {
  const { delivery } = useCatalog();
  const { content } = useSiteContent();
  return {
    brand_name: storeConfig.brandName,
    country: storeConfig.country,
    delivery_price: formatMoney(delivery.standardPence),
    free_delivery_threshold: formatMoney(delivery.freeOverPence),
    delivery_estimate: storeConfig.delivery.estimate,
    returns_days: String(storeConfig.returnsDays),
    contact_email: content.contactEmail,
  };
}
