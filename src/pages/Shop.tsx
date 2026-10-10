import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext";
import ProductCard from "../components/ProductCard";
import { usePageTitle } from "../hooks/usePageTitle";

export default function Shop() {
  usePageTitle("Shop");
  const { categories, products } = useCatalog();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const sort = params.get("sort") ?? "featured";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || (key === "sort" && value === "featured")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = products.filter((p) => {
      const inCategory = category === "all" || p.categoryId === category;
      const matches =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.shortDescription.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term);
      return inCategory && matches;
    });
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.pricePence - b.pricePence);
    else if (sort === "price-desc") sorted.sort((a, b) => b.pricePence - a.pricePence);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
    return sorted;
  }, [products, query, category, sort]);

  return (
    <div className="container section">
      <h1>Shop</h1>
      <div className="filters">
        <div className="field">
          <label htmlFor="search">Search products</label>
          <input id="search" type="search" value={query} onChange={(e) => update("q", e.target.value)} placeholder="For example: lipstick" />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={category} onChange={(e) => update("category", e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => update("sort", e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
            <option value="name">Name, A to Z</option>
          </select>
        </div>
      </div>

      <p className="results-count" role="status">
        {results.length} {results.length === 1 ? "product" : "products"} shown
      </p>

      {results.length === 0 ? (
        <div className="empty">
          <p>No products match your search. Try a different word or choose another category.</p>
          <button type="button" className="button button-quiet" onClick={() => setParams({}, { replace: true })}>
            Clear search and filters
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {results.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
