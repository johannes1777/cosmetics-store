import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { storeConfig } from "../config/store";
import { useCart } from "../context/CartContext";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      {storeConfig.isDemo && (
        <div className="demo-banner" role="note">
          Demo store with sample products. No real orders are taken and no payment is collected.
        </div>
      )}
      <div className="header-row">
        <Link to="/" className="brand" onClick={close}>{storeConfig.brandName}</Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
        <nav id="site-nav" className={open ? "nav open" : "nav"} aria-label="Main">
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <NavLink to="/shop" onClick={close}>Shop</NavLink>
          <NavLink to="/about" onClick={close}>About</NavLink>
          <NavLink to="/contact" onClick={close}>Contact</NavLink>
        </nav>
        <Link to="/cart" className="cart-link" onClick={close}>
          Basket <span className="cart-count" aria-label={`${itemCount} items in basket`}>{itemCount}</span>
        </Link>
      </div>
    </header>
  );
}
