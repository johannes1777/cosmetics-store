import { Link } from "react-router-dom";
import type { Product } from "../types";
import { totalStock } from "../data/catalog";
import { formatMoney } from "../utils/format";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: Product }) {
  const soldOut = totalStock(product) === 0;
  return (
    <article className="card">
      <Link to={`/product/${product.slug}`} className="card-link">
        <div className="card-media">
          <ProductImage product={product} />
          {soldOut && <span className="badge">Sold out</span>}
        </div>
        <h3>{product.name}</h3>
        <p className="muted">{product.shortDescription}</p>
        <p className="price">{formatMoney(product.pricePence)}</p>
      </Link>
      {product.variants.some((v) => v.swatch) && (
        <ul className="dots" aria-label={`${product.name} shades`}>
          {product.variants.map((v) => (
            <li key={v.id} title={v.label} style={{ background: v.swatch }}>
              <span className="visually-hidden">{v.label}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
