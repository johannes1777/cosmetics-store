import { Link } from "react-router-dom";
import type { Order } from "../types";
import { formatMoney } from "../utils/format";
import { usePageTitle } from "../hooks/usePageTitle";
import { LAST_ORDER_KEY } from "./Checkout";

function loadOrder(): Order | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

export default function OrderConfirmation() {
  usePageTitle("Order confirmation");
  const order = loadOrder();

  if (!order) {
    return (
      <div className="container section empty">
        <h1>No recent order found</h1>
        <p>If you have just placed an order, it was saved, but this summary only lasts for the browser tab you ordered in.</p>
        <Link to="/shop" className="button">Go to the shop</Link>
      </div>
    );
  }

  const c = order.customer;
  return (
    <div className="container section narrow">
      <h1>Thank you, {c.fullName.split(" ")[0]}</h1>
      <p className="notice info">
        This was a test order. It was saved as <strong>unpaid</strong>. No payment was taken and no email was sent.
      </p>
      <p>Order reference: <strong>{order.reference}</strong></p>

      <h2>What you ordered</h2>
      <ul className="mini-lines">
        {order.lines.map((l, i) => (
          <li key={i}>
            <span>{l.quantity} × {l.name} <span className="muted">({l.option})</span></span>
            <span>{formatMoney(l.linePence)}</span>
          </li>
        ))}
      </ul>
      <dl className="summary-plain">
        <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotalPence)}</dd></div>
        <div><dt>Delivery</dt><dd>{order.deliveryPence === 0 ? "Free" : formatMoney(order.deliveryPence)}</dd></div>
        <div className="total"><dt>Total (includes VAT)</dt><dd>{formatMoney(order.totalPence)}</dd></div>
      </dl>

      <h2>Delivery to</h2>
      <address>
        {c.fullName}<br />
        {c.address1}<br />
        {c.address2 && <>{c.address2}<br /></>}
        {c.city}<br />
        {c.postcode}
      </address>

      <Link to="/shop" className="button">Continue shopping</Link>
    </div>
  );
}
