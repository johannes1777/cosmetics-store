import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatMoney } from "../utils/format";

type OrderRow = {
  id: string; reference: string; status: string; payment_status: string;
  customer_name: string; customer_email: string; customer_phone: string | null;
  address_line1: string; address_line2: string | null; city: string; postcode: string; country: string;
  subtotal_pence: number; delivery_pence: number; total_pence: number; created_at: string;
  order_items: { id: string; product_name: string; option_label: string; quantity: number; line_pence: number }[];
};

const STATUSES = ["new", "packed", "shipped", "delivered", "cancelled"];

function OrderCard({ order }: { order: OrderRow }) {
  const [saved, setSaved] = useState(order.status);
  const [status, setStatus] = useState(order.status);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const res = await supabase.from("orders").update({ status }).eq("id", order.id).select("id");
    setBusy(false);
    if (res.error) setMessage({ ok: false, text: `Not saved: ${res.error.message}` });
    else if (!res.data || res.data.length === 0) setMessage({ ok: false, text: "Not saved. You may not have permission." });
    else { setSaved(status); setMessage({ ok: true, text: "Status saved." }); }
  }

  return (
    <details className="order-card">
      <summary>
        <span className="order-ref">{order.reference}</span>
        <span>{new Date(order.created_at).toLocaleString("en-GB")}</span>
        <span>{order.customer_name}</span>
        <span>{formatMoney(order.total_pence)}</span>
        <span className="tag">{saved}</span>
        <span className={order.payment_status === "paid" ? "tag" : "tag tag-warn"}>{order.payment_status}</span>
      </summary>
      <div className="order-body">
        <h3>Items</h3>
        <ul className="mini-lines">
          {order.order_items.map((i) => (
            <li key={i.id}><span>{i.quantity} × {i.product_name} <span className="muted">({i.option_label})</span></span><span>{formatMoney(i.line_pence)}</span></li>
          ))}
        </ul>
        <p className="muted">Subtotal {formatMoney(order.subtotal_pence)} · Delivery {formatMoney(order.delivery_pence)} · Total {formatMoney(order.total_pence)}</p>

        <h3>Customer</h3>
        <address>
          {order.customer_name}<br />
          {order.customer_email}{order.customer_phone && <><br />{order.customer_phone}</>}<br />
          {order.address_line1}<br />
          {order.address_line2 && <>{order.address_line2}<br /></>}
          {order.city}<br />{order.postcode}<br />{order.country}
        </address>

        <div className="status-row">
          <label htmlFor={`status-${order.id}`}>Order status</label>
          <select id={`status-${order.id}`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="button" onClick={() => void save()} disabled={busy || status === saved}>{busy ? "Saving…" : "Save status"}</button>
        </div>
        {message && <p className={message.ok ? "notice success" : "notice error"} role="status">{message.text}</p>}
        <p className="muted">Payment status is set automatically once online payments are added. It cannot be changed here.</p>
      </div>
    </details>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setOrders((data ?? []) as unknown as OrderRow[]);
      });
  }, []);

  return (
    <>
      <h1>Orders</h1>
      <p className="notice info">Until online payments are added (Stage 3), every order is unpaid. Do not ship any of them.</p>
      {error && <p className="notice error" role="alert">Could not load orders: {error}</p>}
      {!orders && !error && <p role="status">Loading…</p>}
      {orders && orders.length === 0 && <p>No orders yet.</p>}
      {orders && orders.length > 0 && (
        <>
          <p className="muted">Showing the {orders.length} most recent orders (up to 100).</p>
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </>
      )}
    </>
  );
}
