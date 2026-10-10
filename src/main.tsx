import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { CatalogProvider } from "./context/CatalogContext";
import { SiteContentProvider } from "./context/SiteContentContext";
import { storeConfig } from "./config/store";
import "./styles/global.css";

// Push the colours from config/store.ts into the stylesheet
const root = document.documentElement.style;
root.setProperty("--ink", storeConfig.theme.ink);
root.setProperty("--accent", storeConfig.theme.accent);
root.setProperty("--accent-dark", storeConfig.theme.accentDark);
root.setProperty("--tint", storeConfig.theme.tint);
root.setProperty("--mist", storeConfig.theme.mist);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CatalogProvider>
        <SiteContentProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </SiteContentProvider>
      </CatalogProvider>
    </BrowserRouter>
  </React.StrictMode>
);
