import { Link } from "react-router-dom";
import { storeConfig } from "../config/store";
import { useCatalog } from "../context/CatalogContext";
import { useSiteContent } from "../context/SiteContentContext";

export default function Footer() {
  const { business } = storeConfig;
  const { content } = useSiteContent();
  const { categories } = useCatalog();
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <p className="footer-brand">{storeConfig.brandName}</p>
          <p>{storeConfig.tagline}</p>
          {storeConfig.isDemo && <p className="muted-light">Sample store. All products and details are placeholders.</p>}
        </div>
        <nav aria-label="Shop links">
          <h2>Shop</h2>
          <ul>
            <li><Link to="/shop">All products</Link></li>
            {categories.map((c) => (
              <li key={c.id}><Link to={`/shop?category=${c.id}`}>{c.name}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Customer information">
          <h2>Help</h2>
          <ul>
            <li><Link to="/delivery">Delivery</Link></li>
            <li><Link to="/returns">Returns</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </nav>
        <div>
          <h2>Contact</h2>
          <p>{content.contactEmail}</p>
          <p>{content.contactPhone}</p>
          {storeConfig.isDemo && <p className="muted-light">(placeholder details)</p>}
        </div>
      </div>
      <p className="legal">
        © {new Date().getFullYear()} {business.legalName}. Company no. {business.companyNumber}. VAT no. {business.vatNumber} (placeholders).
      </p>
    </footer>
  );
}
