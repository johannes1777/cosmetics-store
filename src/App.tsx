import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { CatalogGate } from "./context/CatalogContext";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import { About, Contact, Delivery, Returns, Privacy, NotFound } from "./pages/InfoPages";
import AdminApp from "./admin/AdminApp";

// Scroll back to the top (and move focus there) when the page changes
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus();
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();

  // The admin area has its own layout and is not linked from the public menu.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <AdminApp />;

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <Header />
      <ScrollToTop />
      <main id="main" tabIndex={-1}>
        <CatalogGate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CatalogGate>
      </main>
      <Footer />
    </>
  );
}
