import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { storeConfig } from "../config/store";
import { formatMoney } from "../utils/format";
import { useCatalog } from "../context/CatalogContext";
import { supabase } from "../lib/supabase";
import type { CustomerDetails, Order } from "../types";
import { usePageTitle } from "../hooks/usePageTitle";

export const LAST_ORDER_KEY = "store_last_order_test";

// What the database function place_order() sends back
type PlaceOrderResult = {
  reference: string;
  subtotal_pence: number;
  delivery_pence: number;
  total_pence: number;
  lines: { name: string; option: string; quantity: number; line_pence: number }[];
};

// Turns the database's short error codes into plain-English messages
function friendlyOrderError(message: string): string {
  if (message.includes("ERR_OUT_OF_STOCK")) {
    const name = message.split("ERR_OUT_OF_STOCK:")[1]?.split("\n")[0]?.trim();
    return `Sorry, ${name || "one of your items"} no longer has enough stock. We have updated your basket. Please check the quantities and try again.`;
  }
  if (message.includes("ERR_ITEM_UNAVAILABLE")) {
    return "Sorry, one of the items in your basket is no longer available. We have refreshed the shop. Please review your basket and try again.";
  }
  if (message.includes("ERR_INVALID_DETAILS")) {
    return "Some of your details were not accepted. Please check the form and try again.";
  }
  return "Sorry, we could not place your order. Nothing has been charged. Please try again in a moment.";
}

type Errors = Partial<Record<keyof CustomerDetails, string>>;

const emptyForm: CustomerDetails = {
  fullName: "", email: "", phone: "", address1: "", address2: "", city: "", postcode: "",
};

const UK_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d][\d\s()-]{6,}$/;

function validate(f: CustomerDetails): Errors {
  const e: Errors = {};
  if (!f.fullName.trim()) e.fullName = "Enter your full name.";
  if (!f.email.trim()) e.email = "Enter your email address.";
  else if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = "Enter a valid phone number, or leave this blank.";
  if (!f.address1.trim()) e.address1 = "Enter the first line of your address.";
  if (!f.city.trim()) e.city = "Enter your town or city.";
  if (!f.postcode.trim()) e.postcode = "Enter your postcode.";
  else if (!UK_POSTCODE.test(f.postcode.trim())) e.postcode = "Enter a valid UK postcode, like SW1A 1AA.";
  return e;
}

export default function Checkout() {
  usePageTitle("Checkout");
  const { lines, subtotalPence, deliveryPence, totalPence, clear } = useCart();
  const { refresh } = useCatalog();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState<CustomerDetails>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  if (lines.length === 0) {
    return (
      <div className="container section empty">
        <h1>Checkout</h1>
        <p>Your basket is empty, so there is nothing to check out yet.</p>
        <Link to="/shop" className="button">Go to the shop</Link>
      </div>
    );
  }

  const set = (field: keyof CustomerDetails, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const checkField = (field: keyof CustomerDetails) => {
    const found = validate(form)[field];
    setErrors((prev) => ({ ...prev, [field]: found }));
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    const found = validate(form);
    setErrors(found);
    setSaveError("");
    if (Object.keys(found).length > 0) {
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    if (!supabase) {
      setSaveError("The shop is not connected to its database, so the order could not be placed.");
      return;
    }

    setSubmitting(true);
    // We send only IDs and quantities. The database looks up the prices itself.
    const { data, error } = await supabase.rpc("place_order", {
      p_full_name: form.fullName,
      p_email: form.email,
      p_phone: form.phone,
      p_address1: form.address1,
      p_address2: form.address2,
      p_city: form.city,
      p_postcode: form.postcode,
      p_items: lines.map((l) => ({ product_id: l.product.id, variant_id: l.variant.id, quantity: l.quantity })),
    });
    setSubmitting(false);

    if (error || !data) {
      setSaveError(friendlyOrderError(error?.message ?? ""));
      void refresh(); // pick up any stock changes so the basket is corrected
      return;
    }

    const result = data as PlaceOrderResult;
    const order: Order = {
      reference: result.reference,
      createdAt: new Date().toISOString(),
      customer: { ...form, postcode: form.postcode.trim().toUpperCase() },
      lines: result.lines.map((l) => ({ name: l.name, option: l.option, quantity: l.quantity, linePence: l.line_pence })),
      subtotalPence: result.subtotal_pence,
      deliveryPence: result.delivery_pence,
      totalPence: result.total_pence,
    };
    try {
      // Kept in this browser tab only, so the confirmation page can show the delivery address.
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // The order IS saved in the database; only this on-screen summary is lost.
    }
    clear();
    void refresh();
    navigate("/order-confirmation");
  };

  const errorList = Object.entries(errors).filter(([, msg]) => msg) as [keyof CustomerDetails, string][];

  const field = (name: keyof CustomerDetails, label: string, opts: { required?: boolean; type?: string; autoComplete: string; hint?: string }) => {
    const err = errors[name];
    const describedBy = [opts.hint ? `${name}-hint` : "", err ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
    return (
      <div className="field">
        <label htmlFor={name}>{label}{opts.required === false && " (optional)"}</label>
        {opts.hint && <p className="hint" id={`${name}-hint`}>{opts.hint}</p>}
        <input
          id={name} name={name} type={opts.type ?? "text"} value={form[name]} autoComplete={opts.autoComplete}
          aria-invalid={err ? true : undefined} aria-describedby={describedBy}
          onChange={(e) => set(name, e.target.value)} onBlur={() => checkField(name)}
        />
        {err && <p className="field-error" id={`${name}-error`}>{err}</p>}
      </div>
    );
  };

  return (
    <div className="container section">
      <h1>Checkout</h1>
      <p className="notice info">
        Test mode. Please use made-up details only. No payment is taken and no email is sent.
        Your order is saved as <strong>unpaid</strong>.
      </p>

      <div className="cart-layout">
        <form onSubmit={onSubmit} noValidate aria-label="Delivery and contact details">
          {errorList.length > 0 && (
            <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
              <h2>Please fix {errorList.length === 1 ? "this problem" : "these problems"}</h2>
              <ul>
                {errorList.map(([name, msg]) => (
                  <li key={name}><a href={`#${name}`}>{msg}</a></li>
                ))}
              </ul>
            </div>
          )}

          <fieldset>
            <legend>Contact</legend>
            {field("fullName", "Full name", { autoComplete: "name" })}
            {field("email", "Email address", { type: "email", autoComplete: "email", hint: "We use this to send your order confirmation." })}
            {field("phone", "Phone number", { type: "tel", autoComplete: "tel", required: false, hint: "Only used by the courier if there is a delivery problem." })}
          </fieldset>

          <fieldset>
            <legend>Delivery address ({storeConfig.country})</legend>
            {field("address1", "Address line 1", { autoComplete: "address-line1" })}
            {field("address2", "Address line 2", { autoComplete: "address-line2", required: false })}
            {field("city", "Town or city", { autoComplete: "address-level2" })}
            {field("postcode", "Postcode", { autoComplete: "postal-code" })}
          </fieldset>

          {saveError && <p className="notice error" role="alert">{saveError}</p>}
          <button type="submit" className="button button-block" disabled={submitting}>
            {submitting ? "Placing your order…" : `Place test order (${formatMoney(totalPence)})`}
          </button>
        </form>

        <aside className="summary" aria-labelledby="co-summary">
          <h2 id="co-summary">Your order</h2>
          <ul className="mini-lines">
            {lines.map((l) => (
              <li key={l.key}>
                <span>{l.quantity} × {l.product.name} <span className="muted">({l.variant.label})</span></span>
                <span>{formatMoney(l.linePence)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatMoney(subtotalPence)}</dd></div>
            <div><dt>Delivery ({storeConfig.delivery.estimate})</dt><dd>{deliveryPence === 0 ? "Free" : formatMoney(deliveryPence)}</dd></div>
            <div className="total"><dt>Total (includes VAT)</dt><dd>{formatMoney(totalPence)}</dd></div>
          </dl>
          <Link to="/cart" className="center-link">Change basket</Link>
        </aside>
      </div>
    </div>
  );
}
