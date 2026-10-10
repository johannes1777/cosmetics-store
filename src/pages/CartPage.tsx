import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { formatMoney } from "../utils/format";
import ProductImage from "../components/ProductImage";
import QuantityStepper from "../components/QuantityStepper";
import { usePageTitle } from "../hooks/usePageTitle";

export default function CartPage() {
  usePageTitle("Your basket");
  const { lines, subtotalPence, deliveryPence, totalPence, setQuantity, removeItem } = useCart();
  const { delivery } = useCatalog();
  const toFree = delivery.freeOverPence - subtotalPence;

  if (lines.length === 0) {
    return (
      <div className="container section empty">
        <h1>Your basket is empty</h1>
        <p>Add something you like and it will appear here.</p>
        <Link to="/shop" className="button">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1>Your basket</h1>
      <div className="cart-layout">
        <ul className="cart-lines">
          {lines.map((l) => (
            <li key={l.key} className="cart-line">
              <div className="cart-thumb">
                <ProductImage product={l.product} shade={l.variant.swatch} />
              </div>
              <div className="cart-details">
                <Link to={`/product/${l.product.slug}`} className="cart-name">{l.product.name}</Link>
                <p className="muted">{l.product.optionName}: {l.variant.label}</p>
                <p className="muted">{formatMoney(l.product.pricePence)} each</p>
                <div className="cart-controls">
                  <QuantityStepper value={l.quantity} max={Math.min(l.variant.stock, 10)} label={`${l.product.name}, ${l.variant.label}`} onChange={(n) => setQuantity(l.key, n)} />
                  <button type="button" className="link-button" onClick={() => removeItem(l.key)}>
                    Remove<span className="visually-hidden"> {l.product.name}, {l.variant.label}</span>
                  </button>
                </div>
              </div>
              <p className="price cart-total">{formatMoney(l.linePence)}</p>
            </li>
          ))}
        </ul>

        <aside className="summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Order summary</h2>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatMoney(subtotalPence)}</dd></div>
            <div><dt>Delivery</dt><dd>{deliveryPence === 0 ? "Free" : formatMoney(deliveryPence)}</dd></div>
            <div className="total"><dt>Total (includes VAT)</dt><dd>{formatMoney(totalPence)}</dd></div>
          </dl>
          {toFree > 0 && <p className="muted">Spend {formatMoney(toFree)} more for free delivery.</p>}
          <Link to="/checkout" className="button button-block">Go to checkout</Link>
          <Link to="/shop" className="center-link">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
