import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext";
import { useCart } from "../context/CartContext";
import { formatMoney } from "../utils/format";
import ProductImage, { imageViews } from "../components/ProductImage";
import type { ImageView } from "../components/ProductImage";
import QuantityStepper from "../components/QuantityStepper";
import { usePageTitle } from "../hooks/usePageTitle";

export default function ProductPage() {
  const { slug = "" } = useParams();
  // key={slug} gives each product a fresh page, so shade/quantity never carry over
  return <ProductDetails key={slug} slug={slug} />;
}

function ProductDetails({ slug }: { slug: string }) {
  const { getProductBySlug, getCategoryName } = useCatalog();
  const product = getProductBySlug(slug);
  usePageTitle(product?.name ?? "Product not found");
  const { addItem } = useCart();

  const [variantId, setVariantId] = useState<string>(
    () => product?.variants.find((v) => v.stock > 0)?.id ?? product?.variants[0]?.id ?? ""
  );
  const [view, setView] = useState<ImageView>("front");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!product) {
    return (
      <div className="container section empty">
        <h1>We could not find that product</h1>
        <p>It may have been removed. Browse the rest of the shop instead.</p>
        <Link to="/shop" className="button">Go to the shop</Link>
      </div>
    );
  }

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const inStock = variant.stock > 0;
  const stockText = !inStock ? "Out of stock" : variant.stock <= 5 ? `Only ${variant.stock} left in stock` : "In stock";

  const chooseVariant = (id: string) => {
    const next = product.variants.find((v) => v.id === id);
    setVariantId(id);
    setMessage(null);
    if (next) setQuantity((q) => Math.max(1, Math.min(q, next.stock || 1)));
  };

  const handleAdd = () => {
    const result = addItem(product.id, variant.id, quantity);
    setMessage({ ok: result.ok, text: result.message });
  };

  return (
    <div className="container section">
      <p className="breadcrumb">
        <Link to="/shop">Shop</Link> / <Link to={`/shop?category=${product.categoryId}`}>{getCategoryName(product.categoryId)}</Link>
      </p>
      <div className="product-layout">
        <div>
          {product.images.length > 0 ? (
            <>
              <div className="gallery-main">
                <img
                  className="product-image"
                  src={product.images[Math.min(photoIndex, product.images.length - 1)].url}
                  alt={product.images[Math.min(photoIndex, product.images.length - 1)].alt}
                  decoding="async"
                />
              </div>
              {product.images.length > 1 && (
                <ul className="thumbs" aria-label="Product photos">
                  {product.images.map((photo, i) => (
                    <li key={photo.id}>
                      <button type="button" aria-pressed={photoIndex === i} onClick={() => setPhotoIndex(i)} aria-label={`Show photo ${i + 1} of ${product.images.length}`}>
                        <img className="product-image" src={photo.url} alt="" loading="lazy" decoding="async" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="gallery-main">
                <ProductImage product={product} view={view} shade={variant.swatch} />
              </div>
              <ul className="thumbs" aria-label="Product photos">
                {imageViews.map((v) => (
                  <li key={v}>
                    <button type="button" aria-pressed={view === v} onClick={() => setView(v)} aria-label={`Show ${v} image`}>
                      <ProductImage product={product} view={v} shade={variant.swatch} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="price price-large">{formatMoney(product.pricePence)}</p>
          <p className="muted">Price includes VAT. Delivery is calculated at checkout.</p>
          <p>{product.description}</p>

          <fieldset className="options">
            <legend>{product.optionName}: <strong>{variant.label}</strong></legend>
            <div className="option-list">
              {product.variants.map((v) => (
                <label key={v.id} className={v.stock <= 0 ? "option disabled" : "option"}>
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={v.id === variant.id}
                    onChange={() => chooseVariant(v.id)}
                  />
                  {v.swatch && <span className="option-dot" style={{ background: v.swatch }} aria-hidden="true" />}
                  <span>{v.label}{v.stock <= 0 ? " (sold out)" : ""}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className={inStock ? "stock ok" : "stock out"} role="status">{stockText}</p>

          {inStock && (
            <div className="buy-row">
              <QuantityStepper value={quantity} max={Math.min(variant.stock, 10)} label={product.name} onChange={setQuantity} />
              <button type="button" className="button" onClick={handleAdd}>Add to basket</button>
            </div>
          )}

          {message && (
            <p className={message.ok ? "notice success" : "notice error"} role="status">
              {message.text} {message.ok && <Link to="/cart">View basket</Link>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
