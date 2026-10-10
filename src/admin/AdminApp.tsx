import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, RequireAdmin, useAdminAuth } from "./AdminAuth";
import AdminProducts from "./AdminProducts";
import ProductForm from "./ProductForm";
import AdminOrders from "./AdminOrders";
import AdminHomepage from "./AdminHomepage";
import AdminPages from "./AdminPages";
import { storeConfig } from "../config/store";

function LoginPage() {
  const { status, signIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "admin") return <Navigate to="/admin" replace />;

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setBusy(true);
    setError("");
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="admin-login">
      <h1>Admin sign in</h1>
      <form onSubmit={onSubmit} noValidate>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="admin-email">Email address</label>
          <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="button button-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="center-link"><Link to="/">Back to the shop</Link></p>
    </div>
  );
}

function AdminLayout() {
  const { email, signOut } = useAdminAuth();
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <strong>{storeConfig.brandName} admin</strong>
        <nav aria-label="Admin">
          <NavLink to="/admin" end>Products</NavLink>
          <NavLink to="/admin/homepage">Homepage</NavLink>
          <NavLink to="/admin/pages">Pages</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <Link to="/" target="_blank" rel="noreferrer">View shop</Link>
        </nav>
        <span className="admin-user">{email}</span>
        <button type="button" className="link-button" onClick={() => void signOut()}>Sign out</button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminApp() {
  // Ask search engines not to list the admin pages
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    document.title = `Admin | ${storeConfig.brandName}`;
    return () => { document.head.removeChild(meta); };
  }, []);

  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminProducts />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="homepage" element={<AdminHomepage />} />
          <Route path="pages" element={<AdminPages />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="*" element={<p>That admin page does not exist.</p>} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
