import { Fragment } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { storeConfig } from "../config/store";
import { useCatalog } from "../context/CatalogContext";
import { useSiteContent } from "../context/SiteContentContext";
import { formatMoney } from "../utils/format";
import { publicImageUrl } from "../lib/storage";
import { applyTokens } from "../content/RichText";
import { useContentTokens } from "../content/tokens";
import type { SectionKey } from "../types";
import ProductCard from "../components/ProductCard";
import SafeLink from "../components/SafeLink";
import { usePageTitle } from "../hooks/usePageTitle";

// Decorative colours shown when no hero picture has been uploaded
const heroShades = ["#e8a0b0", "#c2334f", "#a8505f", "#e07a5f", "#d9a37f", "#8e234a", "#c9a3c4"];

export default function Home() {
  usePageTitle();
  const { categories, products, delivery } = useCatalog();
  const { content, sections } = useSiteContent();
  const tokens = useContentTokens();
  const featured = products.filter((p) => p.featured).slice(0, 4);

  const shown = sections
    .filter((s) => s.visible)
    .sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));

  const blocks: Record<SectionKey, ReactNode> = {
    hero: (
      <section className="hero">
        <div className="hero-text">
          <h1>{applyTokens(content.heroHeadline, tokens)}</h1>
          <p>{applyTokens(content.heroText, tokens)}</p>
          <div className="hero-actions">
            <SafeLink to={content.heroButtonLink} className="button">{content.heroButtonLabel}</SafeLink>
          </div>
        </div>
        {content.heroImagePath ? (
          <img className="hero-image" src={publicImageUrl(content.heroImagePath)} alt={content.heroImageAlt} decoding="async" />
        ) : (
          <div className="hero-shades" aria-hidden="true">
            {heroShades.map((colour, i) => (
              <span key={colour} style={{ background: colour, height: `${55 + ((i * 17) % 40)}%` }} />
            ))}
          </div>
        )}
      </section>
    ),
    categories: (
      <section className="container section" aria-labelledby="cat-heading">
        <h2 id="cat-heading">Shop by category</h2>
        <ul className="category-grid">
          {categories.map((c) => (
            <li key={c.id}>
              <Link to={`/shop?category=${c.id}`} className="category-tile" style={{ borderColor: c.tone }}>
                <span className="category-swatch" style={{ background: c.tone }} aria-hidden="true" />
                <span className="category-name">{c.name}</span>
                <span className="muted">{c.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ),
    featured: (
      <section className="container section" aria-labelledby="featured-heading">
        <div className="section-head">
          <h2 id="featured-heading">Featured products</h2>
          <Link to="/shop">See everything</Link>
        </div>
        <div className="product-grid">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    ),
    promise: (
      <section className="container section promise" aria-label="Delivery and returns">
        <p>Free delivery on orders over {formatMoney(delivery.freeOverPence)}</p>
        <p>Standard delivery in {storeConfig.delivery.estimate}</p>
        <p>{storeConfig.returnsDays}-day returns on unopened items</p>
      </section>
    ),
  };

  const heroShown = shown.some((s) => s.key === "hero");

  return (
    <>
      {/* Every page needs one main heading, even if the owner hides the hero banner */}
      {!heroShown && <h1 className="visually-hidden">{storeConfig.brandName}</h1>}
      {shown.map((s) => <Fragment key={s.key}>{blocks[s.key]}</Fragment>)}
    </>
  );
}
