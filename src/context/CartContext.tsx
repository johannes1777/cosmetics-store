import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CartItem, CartLine } from "../types";
import { useCatalog } from "./CatalogContext";
import { calcDelivery } from "../utils/format";

const STORAGE_KEY = "store_cart_v2";

type AddResult = { ok: boolean; message: string };

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
  addItem: (productId: string, variantId: string, quantity: number) => AddResult;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const lineKey = (productId: string, variantId: string) => `${productId}:${variantId}`;

// Read the saved cart from the browser, ignoring anything that looks wrong.
function loadItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: CartItem[] = [];
    for (const entry of parsed) {
      if (
        entry && typeof entry.productId === "string" &&
        typeof entry.variantId === "string" && Number.isInteger(entry.quantity) && entry.quantity > 0
      ) {
        items.push({ productId: entry.productId, variantId: entry.variantId, quantity: entry.quantity });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { getProductById, delivery } = useCatalog();
  const [items, setItems] = useState<CartItem[]>(loadItems);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage can be blocked (for example in private browsing). The cart still works for this visit.
    }
  }, [items]);

  // Join each saved item with its product, dropping items that no longer exist
  // and never allowing more than the stock available.
  const lines = useMemo<CartLine[]>(() => {
    const result: CartLine[] = [];
    for (const item of items) {
      const product = getProductById(item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      if (!product || !variant || variant.stock <= 0) continue;
      const quantity = Math.min(item.quantity, variant.stock);
      result.push({
        key: lineKey(product.id, variant.id),
        product,
        variant,
        quantity,
        linePence: product.pricePence * quantity,
      });
    }
    return result;
  }, [items, getProductById]);

  const addItem = useCallback((productId: string, variantId: string, quantity: number): AddResult => {
    const product = getProductById(productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return { ok: false, message: "Sorry, we could not find that product." };
    if (variant.stock <= 0) return { ok: false, message: "Sorry, that option is out of stock." };

    const existing = items.find((i) => i.productId === productId && i.variantId === variantId);
    const wanted = (existing?.quantity ?? 0) + quantity;
    const finalQty = Math.min(wanted, variant.stock);
    setItems((current) => {
      const found = current.find((i) => i.productId === productId && i.variantId === variantId);
      if (found) {
        return current.map((i) => (i === found ? { ...i, quantity: finalQty } : i));
      }
      return [...current, { productId, variantId, quantity: finalQty }];
    });
    return wanted > variant.stock
      ? { ok: true, message: `Only ${variant.stock} in stock, so your basket now has the most we can offer.` }
      : { ok: true, message: "Added to your basket." };
  }, [items, getProductById]);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((current) =>
      current
        .map((i) => (lineKey(i.productId, i.variantId) === key ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((current) => current.filter((i) => lineKey(i.productId, i.variantId) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotalPence = lines.reduce((sum, l) => sum + l.linePence, 0);
    const deliveryPence = calcDelivery(subtotalPence, delivery);
    return {
      lines,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotalPence,
      deliveryPence,
      totalPence: subtotalPence + deliveryPence,
      addItem,
      setQuantity,
      removeItem,
      clear,
    };
  }, [lines, delivery, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
