# Cosmetics Store Template (Stage 2: database, admin and editable content)

React + TypeScript + Vite storefront connected to Supabase (database and admin sign-in).
**Online payments are not built yet (Stage 3). Every order is saved as unpaid.**

**Start with `SETUP.md`** (Part 1 is the database and admin, Part 2 is editable content and photos, migration 004). It walks through connecting Supabase, running the SQL, creating your
one admin account, and testing the security rules.

## Run

1. `npm install`
2. Create `.env.local` (see `.env.example`; never commit it)
3. `npm run dev`
4. Shop at http://localhost:5173, admin at http://localhost:5173/admin

`npm run build` makes the Netlify build (add the same two `VITE_` variables in Netlify's settings first).

## Reuse it for a new client

- `src/config/store.ts`: brand name, currency, wording, contact details, colours
- Supabase table `store_settings`: delivery prices (edit in the Table Editor)
- Products, options, stock and product photos: through `/admin`
- Homepage banner, section order, and the About, Contact, Delivery, Returns and Privacy pages: through `/admin` (Homepage and Pages)
- `src/pages/InfoPages.tsx`: About, Contact, Delivery, Returns and Privacy wording

## Folder guide

- `supabase/`: SQL files (run in order: 001, 002, 003, then 004), sample data, and the self-tests
  (`verify_security.sql`, `verify_storefront.sql`)
- `src/content/`: safe text renderer, starter text, and the fill-in words
- `src/admin/`: admin sign-in, products, orders
- `src/context/CatalogContext.tsx`: loads products and settings from the database
- `src/pages/`: shop pages
