import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ProductPhotos from "./ProductPhotos";

type VariantDraft = {
  key: string; // local id used only for the on-screen list
  id?: string; // database id (missing for options you just added)
  label: string;
  swatch: string; // "" means no colour dot
  stock: string;
  originalStock?: number;
};

type FormState = {
  name: string; slug: string; categoryId: string; shortDescription: string; description: string;
  price: string; optionName: string; tone: string; featured: boolean; active: boolean;
};

type CategoryOption = { id: string; name: string };
type Errors = Record<string, string>;

const emptyForm: FormState = {
  name: "", slug: "", categoryId: "", shortDescription: "", description: "",
  price: "", optionName: "Shade", tone: "#b4325f", featured: false, active: true,
};

let counter = 0;
const newKey = () => `v${++counter}`;
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const HEX = /^#[0-9a-fA-F]{6}$/;

function parsePence(input: string): number | null {
  const t = input.trim();
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return null;
  const pence = Math.round(Number(t) * 100);
  return pence <= 1000000 ? pence : null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={id}>{message}</p> : null;
}

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [variants, setVariants] = useState<VariantDraft[]>([{ key: newKey(), label: "", swatch: "", stock: "0" }]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    async function load() {
      const cats = await db.from("categories").select("id, name").order("sort_order");
      if (cats.error) { setLoadError(cats.error.message); return; }
      setCategories((cats.data ?? []) as CategoryOption[]);
      if (id) {
        const res = await db.from("products").select("*, product_variants(*)").eq("id", id).single();
        if (res.error || !res.data) { setLoadError(res.error?.message ?? "Product not found."); return; }
        const p = res.data as {
          name: string; slug: string; category_id: string; short_description: string; description: string;
          price_pence: number; option_name: string; tone: string; featured: boolean; active: boolean;
          product_variants: { id: string; label: string; swatch: string | null; stock: number; sort_order: number }[];
        };
        setForm({
          name: p.name, slug: p.slug, categoryId: p.category_id, shortDescription: p.short_description,
          description: p.description, price: (p.price_pence / 100).toFixed(2), optionName: p.option_name,
          tone: p.tone, featured: p.featured, active: p.active,
        });
        const sorted = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
        setVariants(sorted.map((v) => ({ key: newKey(), id: v.id, label: v.label, swatch: v.swatch ?? "", stock: String(v.stock), originalStock: v.stock })));
        setOriginalIds(sorted.map((v) => v.id));
      } else if ((cats.data ?? []).length > 0) {
        setForm((f) => ({ ...f, categoryId: (cats.data as CategoryOption[])[0].id }));
      }
      setLoaded(true);
    }
    void load();
  }, [id]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }));
  const setVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  function validate(): Errors {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Enter a product name.";
    if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = "Use only lowercase letters, numbers and hyphens, like velvet-lipstick.";
    if (!form.categoryId) e.categoryId = "Choose a category.";
    if (parsePence(form.price) === null) e.price = "Enter a price in pounds, like 14 or 14.50 (up to 10000).";
    if (!form.optionName.trim()) e.optionName = "Enter what the options are called, such as Shade or Size.";
    if (variants.length === 0) e.variants = "Add at least one option.";
    const seen = new Set<string>();
    for (const v of variants) {
      const label = v.label.trim();
      if (!label) e[`label-${v.key}`] = "Enter a name for this option.";
      else if (seen.has(label.toLowerCase())) e[`label-${v.key}`] = "Two options have the same name.";
      seen.add(label.toLowerCase());
      if (!/^\d{1,6}$/.test(v.stock.trim())) e[`stock-${v.key}`] = "Enter a whole number, 0 or more.";
    }
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!supabase || saving) return;
    const found = validate();
    setErrors(found);
    setSaveError("");
    if (Object.keys(found).length > 0) { setTimeout(() => summaryRef.current?.focus(), 0); return; }

    const db = supabase;
    setSaving(true);
    const productFields = {
      slug: form.slug, name: form.name.trim(), category_id: form.categoryId,
      short_description: form.shortDescription.trim(), description: form.description.trim(),
      price_pence: parsePence(form.price) as number, option_name: form.optionName.trim(),
      featured: form.featured, active: form.active, tone: form.tone,
    };

    if (isNew) {
      const res = await db.from("products").insert(productFields).select("id").single();
      if (res.error || !res.data) {
        setSaving(false);
        setSaveError(res.error?.code === "23505" ? "That web address (slug) is already used by another product. Change it and try again." : `Could not save the product: ${res.error?.message ?? "unknown error"}`);
        return;
      }
      const productId = (res.data as { id: string }).id;
      const vr = await db.from("product_variants").insert(
        variants.map((v, i) => ({ product_id: productId, label: v.label.trim(), swatch: v.swatch || null, stock: Number(v.stock), sort_order: i }))
      );
      setSaving(false);
      if (vr.error) {
        setCreatedId(productId);
        setSaveError(`The product was created, but its options could not be saved: ${vr.error.message}`);
        return;
      }
      navigate("/admin");
      return;
    }

    // Editing an existing product
    const up = await db.from("products").update(productFields).eq("id", id as string).select("id");
    if (up.error || !up.data || up.data.length !== 1) {
      setSaving(false);
      setSaveError(up.error?.code === "23505" ? "That web address (slug) is already used by another product." : `Could not save the product: ${up.error?.message ?? "no permission or product not found"}`);
      return;
    }

    const problems: string[] = [];
    const keep = new Set(variants.filter((v) => v.id).map((v) => v.id as string));
    const removed = originalIds.filter((oid) => !keep.has(oid));
    if (removed.length > 0) {
      const del = await db.from("product_variants").delete().in("id", removed);
      if (del.error) problems.push(del.error.message);
    }
    for (const [i, v] of variants.entries()) {
      const base = { label: v.label.trim(), swatch: v.swatch || null, sort_order: i };
      const stock = Number(v.stock);
      if (v.id) {
        // Only send stock if you changed it, so an old open form can't overwrite sales made meanwhile.
        const payload = stock !== v.originalStock ? { ...base, stock } : base;
        const r = await db.from("product_variants").update(payload).eq("id", v.id);
        if (r.error) problems.push(r.error.message);
      } else {
        const r = await db.from("product_variants").insert({ ...base, product_id: id as string, stock });
        if (r.error) problems.push(r.error.message);
      }
    }
    setSaving(false);
    if (problems.length > 0) {
      setSaveError(`Some changes could not be saved: ${problems[0]}`);
      return;
    }
    navigate("/admin");
  }

  if (loadError) return <p className="notice error" role="alert">Could not load this page: {loadError}</p>;
  if (!loaded) return <p role="status">Loading…</p>;

  const errorList = Object.values(errors);
  const describe = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <>
      <p className="breadcrumb"><Link to="/admin">Products</Link> / {isNew ? "New product" : form.name}</p>
      <h1>{isNew ? "Add a product" : "Edit product"}</h1>

      <form onSubmit={onSubmit} noValidate className="admin-form">
        {errorList.length > 0 && (
          <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
            <h2>Please fix {errorList.length === 1 ? "this problem" : "these problems"}</h2>
            <ul>{errorList.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
        {saveError && (
          <p className="notice error" role="alert">
            {saveError} {createdId && <Link to={`/admin/products/${createdId}`}>Open the product to add options</Link>}
          </p>
        )}

        <fieldset>
          <legend>Details</legend>
          <div className="field">
            <label htmlFor="name">Product name</label>
            <input id="name" value={form.name} aria-invalid={errors.name ? true : undefined} aria-describedby={describe("name")}
              onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} />
            <FieldError id="name-error" message={errors.name} />
          </div>
          <div className="field">
            <label htmlFor="slug">Web address ending (slug)</label>
            <p className="hint" id="slug-hint">Used in the product link, for example /product/velvet-lipstick</p>
            <input id="slug" value={form.slug} aria-invalid={errors.slug ? true : undefined} aria-describedby={`slug-hint ${describe("slug") ?? ""}`.trim()}
              onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
            <FieldError id="slug-error" message={errors.slug} />
          </div>
          <div className="field">
            <label htmlFor="categoryId">Category</label>
            <select id="categoryId" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} aria-invalid={errors.categoryId ? true : undefined} aria-describedby={describe("categoryId")}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <FieldError id="categoryId-error" message={errors.categoryId} />
          </div>
          <div className="field">
            <label htmlFor="shortDescription">Short description</label>
            <input id="shortDescription" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="description">Full description</label>
            <textarea id="description" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Price and options</legend>
          <div className="field">
            <label htmlFor="price">Price in pounds (includes VAT)</label>
            <input id="price" inputMode="decimal" value={form.price} aria-invalid={errors.price ? true : undefined} aria-describedby={describe("price")} onChange={(e) => set("price", e.target.value)} />
            <FieldError id="price-error" message={errors.price} />
          </div>
          <div className="field">
            <label htmlFor="optionName">What are the options called?</label>
            <input id="optionName" value={form.optionName} aria-invalid={errors.optionName ? true : undefined} aria-describedby={describe("optionName")} onChange={(e) => set("optionName", e.target.value)} />
            <FieldError id="optionName-error" message={errors.optionName} />
          </div>
          <div className="field">
            <label htmlFor="tone">Colour of the sample picture</label>
            <input id="tone" type="color" value={form.tone} onChange={(e) => set("tone", e.target.value)} />
          </div>

          <h3>Options and stock</h3>
          <FieldError id="variants-error" message={errors.variants} />
          <ul className="variant-list">
            {variants.map((v, index) => (
              <li key={v.key} className="variant-row">
                <div className="field">
                  <label htmlFor={`label-${v.key}`}>Option {index + 1} name</label>
                  <input id={`label-${v.key}`} value={v.label} aria-invalid={errors[`label-${v.key}`] ? true : undefined} aria-describedby={describe(`label-${v.key}`)} onChange={(e) => setVariant(v.key, { label: e.target.value })} />
                  <FieldError id={`label-${v.key}-error`} message={errors[`label-${v.key}`]} />
                </div>
                <div className="field">
                  <label htmlFor={`stock-${v.key}`}>In stock</label>
                  <input id={`stock-${v.key}`} inputMode="numeric" value={v.stock} aria-invalid={errors[`stock-${v.key}`] ? true : undefined} aria-describedby={describe(`stock-${v.key}`)} onChange={(e) => setVariant(v.key, { stock: e.target.value })} />
                  <FieldError id={`stock-${v.key}-error`} message={errors[`stock-${v.key}`]} />
                </div>
                <div className="field">
                  <label htmlFor={`swatch-${v.key}`}>Colour dot (optional)</label>
                  <div className="swatch-control">
                    <input id={`swatch-${v.key}`} type="color" value={HEX.test(v.swatch) ? v.swatch : "#cccccc"} onChange={(e) => setVariant(v.key, { swatch: e.target.value })} />
                    {v.swatch ? (
                      <button type="button" className="link-button" onClick={() => setVariant(v.key, { swatch: "" })}>Clear</button>
                    ) : <span className="muted">None</span>}
                  </div>
                </div>
                <button type="button" className="link-button" onClick={() => setVariants((list) => list.filter((x) => x.key !== v.key))}>
                  Remove<span className="visually-hidden"> option {index + 1}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="button button-quiet" onClick={() => setVariants((list) => [...list, { key: newKey(), label: "", swatch: "", stock: "0" }])}>
            Add another option
          </button>
          {!isNew && <p className="muted">Removing an option removes it from the shop. Past orders keep their own record of what was bought.</p>}
        </fieldset>

        <fieldset>
          <legend>Visibility</legend>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Show this product in the shop</label>
          <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Feature on the homepage</label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="button" disabled={saving}>{saving ? "Saving…" : "Save product"}</button>
          <Link to="/admin" className="button button-quiet">Cancel</Link>
        </div>
      </form>

      {isNew ? (
        <p className="notice info">Save the product first, then you can add photos to it.</p>
      ) : (
        <ProductPhotos productId={id as string} />
      )}
    </>
  );
}
