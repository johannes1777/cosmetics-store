import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Category, Product } from "../types";
import { fetchCatalog } from "../data/catalog";
import type { DeliverySettings } from "../data/catalog";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSiteContent } from "./SiteContentContext";

type Status = "loading" | "ready" | "error" | "not-configured";

type CatalogContextValue = {
  status: Status;
  errorMessage: string;
  categories: Category[];
  products: Product[];
  delivery: DeliverySettings;
  refresh: () => Promise<void>; // quietly re-reads stock and prices
  getProductBySlug: (slug: string) => Product | undefined;
  getProductById: (id: string) => Product | undefined;
  getCategoryName: (id: string) => string;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "not-configured");
  const [errorMessage, setErrorMessage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [delivery, setDelivery] = useState<DeliverySettings>({ standardPence: 0, freeOverPence: 0 });

  const load = useCallback(async (quiet: boolean) => {
    if (!isSupabaseConfigured) return;
    if (!quiet) setStatus("loading");
    try {
      const c = await fetchCatalog();
      setCategories(c.categories);
      setProducts(c.products);
      setDelivery(c.delivery);
      setStatus("ready");
    } catch (err) {
      if (quiet) return; // keep showing what we already have
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const value = useMemo<CatalogContextValue>(() => ({
    status,
    errorMessage,
    categories,
    products,
    delivery,
    refresh: () => load(true),
    getProductBySlug: (slug) => products.find((p) => p.slug === slug),
    getProductById: (id) => products.find((p) => p.id === id),
    getCategoryName: (id) => categories.find((c) => c.id === id)?.name ?? "",
  }), [status, errorMessage, categories, products, delivery, load]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}

// Shows a loading / error / "not connected" message instead of the shop pages
// until the catalogue is ready.
export function CatalogGate({ children }: { children: ReactNode }) {
  const { status, errorMessage } = useCatalog();
  const { status: contentStatus } = useSiteContent();

  if (status === "ready" && contentStatus !== "loading") return <>{children}</>;

  if (status === "loading" || status === "ready") {
    return <div className="container section empty" role="status"><p>Loading the shop…</p></div>;
  }
  if (status === "not-configured") {
    return (
      <div className="container section narrow prose">
        <h1>The shop is not connected to its database yet</h1>
        <p>
          The site could not find its Supabase settings. Create a file called <code>.env.local</code> next to
          <code> package.json</code> with <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>,
          then restart the site. SETUP.md has the steps.
        </p>
      </div>
    );
  }
  return (
    <div className="container section empty" role="alert">
      <h1>We could not load the shop</h1>
      <p>Please check your internet connection and try again.</p>
      <p className="muted">Technical detail: {errorMessage}</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}
