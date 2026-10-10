import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { storeConfig } from "../config/store";
import { useSiteContent } from "../context/SiteContentContext";
import { publicImageUrl } from "../lib/storage";
import RichText from "../content/RichText";
import { useContentTokens } from "../content/tokens";
import { usePageTitle } from "../hooks/usePageTitle";
import type { PageKey } from "../types";

// One template for every information page: a title, an optional picture, then the text.
// Owners change the words and the picture in the admin; the layout stays fixed.
function ContentPage({ pageKey, notice, children }: { pageKey: PageKey; notice?: string; children?: ReactNode }) {
  const { pages } = useSiteContent();
  const page = pages[pageKey];
  const tokens = useContentTokens();
  usePageTitle(page.title);

  return (
    <div className="container section narrow prose">
      <h1>{page.title}</h1>
      {storeConfig.isDemo && notice && <p className="notice info">{notice}</p>}
      {page.imagePath && (
        <img className="page-image" src={publicImageUrl(page.imagePath)} alt={page.imageAlt} decoding="async" />
      )}
      <RichText text={page.body} tokens={tokens} />
      {children}
    </div>
  );
}

const TEMPLATE_NOTICE = "Template wording. Replace it with your own policy and have it checked by a qualified adviser before you launch.";

export function About() {
  return (
    <ContentPage pageKey="about">
      <Link to="/shop" className="button">Shop the range</Link>
    </ContentPage>
  );
}

export function Contact() {
  const { content } = useSiteContent();
  const addressLines = content.contactAddress.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <ContentPage pageKey="contact" notice="These are placeholder contact details for the demo. None of them are real.">
      <dl className="details">
        <div><dt>Email</dt><dd>{content.contactEmail}</dd></div>
        <div><dt>Phone</dt><dd>{content.contactPhone}</dd></div>
        <div><dt>Opening hours</dt><dd>{content.contactHours}</dd></div>
        <div>
          <dt>Address</dt>
          <dd>{addressLines.map((line, i) => <span key={i}>{line}<br /></span>)}</dd>
        </div>
      </dl>
    </ContentPage>
  );
}

export const Delivery = () => <ContentPage pageKey="delivery" notice={TEMPLATE_NOTICE} />;
export const Returns = () => <ContentPage pageKey="returns" notice={TEMPLATE_NOTICE} />;
export const Privacy = () => <ContentPage pageKey="privacy" notice={TEMPLATE_NOTICE} />;

export function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="container section empty">
      <h1>Page not found</h1>
      <p>The page you wanted does not exist or has moved.</p>
      <Link to="/" className="button">Back to the homepage</Link>
    </div>
  );
}
