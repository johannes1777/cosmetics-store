// Button links are checked here AND in the database (supabase/004_storefront_content.sql).
// Allowed: a path inside the shop that starts with ONE slash ("/shop"),
// or a full https:// address. Refused: "//host", backslashes, spaces, control
// characters, http://, javascript:, mailto:, data: and everything else.
export function isSafeLink(link: string): boolean {
  if (link.length < 1 || link.length > 300) return false;
  if (/[\u0000-\u001f\u007f\s\\]/.test(link)) return false;
  if (link.startsWith("/")) return !link.startsWith("//");
  return /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#].*)?$/i.test(link);
}

export const isExternalLink = (link: string) => link.startsWith("https://");

export const LINK_HELP =
  "Use a page inside your shop that starts with a single / (for example /shop or /shop?category=lips), " +
  "or a full address starting with https://. Links that start with //, contain spaces or backslashes, " +
  "or use http://, mailto: or other formats are not allowed.";
