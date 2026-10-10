import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatMoney } from "../utils/format";

type Row = {
  id: string;
  name: string;
  slug: string;
  price_pence: number;
  active: boolean;
  featured: boolean;
  category_id: string;
  product_variants: { stock: number }[];
};

export default function AdminProducts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("products")
      .select("id, name, slug, price_pence, active, featured, category_id, product_variants(stock)")
      .order("created_at")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data ?? []) as unknown as Row[]);
      });
  }, []);

  return (
    <>
      <div className="section-head">
        <h1>Products</h1>
        <Link to="/admin/products/new" className="button">Add product</Link>
      </div>
      {error && <p className="notice error" role="alert">Could not load products: {error}</p>}
      {!rows && !error && <p role="status">Loading…</p>}
      {rows && rows.length === 0 && <p>No products yet. Add your first one.</p>}
      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Shown in shop</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const stock = r.product_variants.reduce((s, v) => s + v.stock, 0);
                return (
                  <tr key={r.id}>
                    <th scope="row">{r.name}{r.featured && <span className="tag">Featured</span>}</th>
                    <td>{r.category_id}</td>
                    <td>{formatMoney(r.price_pence)}</td>
                    <td className={stock === 0 ? "stock out" : undefined}>{stock === 0 ? "Sold out" : stock}</td>
                    <td>{r.active ? "Yes" : "Hidden"}</td>
                    <td><Link to={`/admin/products/${r.id}`}>Edit<span className="visually-hidden"> {r.name}</span></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
