-- ============================================================
-- seed.sql  -  SAMPLE DATA (optional, run after 001, 002, 003)
-- ============================================================
-- Twelve made-up cosmetics products so the shop is not empty.
-- Safe to run twice: products that already exist are skipped.
-- Delete or replace these before a real client launches.

insert into public.categories (id, name, blurb, tone, sort_order) values ('lips', 'Lips', 'Lipsticks, tints and balms', '#b4325f', 0) on conflict (id) do nothing;
insert into public.categories (id, name, blurb, tone, sort_order) values ('face', 'Face', 'Foundation, blush and powder', '#d9a08a', 1) on conflict (id) do nothing;
insert into public.categories (id, name, blurb, tone, sort_order) values ('skincare', 'Skincare', 'Cleanse, treat and protect', '#8fae9f', 2) on conflict (id) do nothing;
insert into public.categories (id, name, blurb, tone, sort_order) values ('body', 'Body', 'Lotions, oils and scrubs', '#c9a3c4', 3) on conflict (id) do nothing;

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('velvet-matte-lipstick', 'Velvet Matte Lipstick', 'lips', 'Comfortable, full-colour matte finish.', 'A sample lipstick description. Smooth matte colour that feels light on the lips and lasts through the day. Replace this text with the real product details.', 1400, 'Shade', true, '#b4325f')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('Rosewood', '#a8505f', 12, 0),
         ('Berry Crush', '#8e234a', 8, 1),
         ('Soft Coral', '#e07a5f', 3, 2),
         ('Warm Nude', '#c48b7a', 0, 3)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('glass-shine-lip-tint', 'Glass Shine Lip Tint', 'lips', 'Sheer, glossy wash of colour.', 'A sample lip tint description. A lightweight gloss with a hint of colour. Replace this text with the real product details.', 1100, 'Shade', true, '#e07a8f')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('Petal', '#e8a0b0', 20, 0),
         ('Cherry', '#c2334f', 15, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('overnight-lip-balm', 'Overnight Lip Balm', 'lips', 'Rich balm for soft lips by morning.', 'A sample balm description. Replace this text with the real product details.', 800, 'Size', false, '#c9a3c4')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('10 g', null::text, 30, 0),
         ('20 g', null::text, 10, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('second-skin-foundation', 'Second Skin Foundation', 'face', 'Light, buildable coverage.', 'A sample foundation description. Buildable coverage with a natural finish. Replace this text with the real product details.', 2200, 'Shade', true, '#d9a08a')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('Light 10', '#f0cdb8', 9, 0),
         ('Medium 30', '#d9a37f', 14, 1),
         ('Tan 50', '#b57b57', 6, 2),
         ('Deep 70', '#7d4e36', 4, 3)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('petal-pop-blush', 'Petal Pop Cream Blush', 'face', 'Blendable cream blush for a fresh flush.', 'A sample blush description. Replace this text with the real product details.', 1600, 'Shade', true, '#e58f9a')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('Peach', '#f0a58f', 11, 0),
         ('Rose', '#d9708a', 7, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('silk-setting-powder', 'Silk Setting Powder', 'face', 'Soft-focus finish that keeps makeup in place.', 'A sample powder description. Replace this text with the real product details.', 1800, 'Size', false, '#e8cdb8')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('8 g', null::text, 18, 0),
         ('15 g', null::text, 5, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('gentle-cream-cleanser', 'Gentle Cream Cleanser', 'skincare', 'Removes makeup without stripping skin.', 'A sample cleanser description. Replace this text with the real product details, including ingredients.', 1500, 'Size', true, '#8fae9f')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('100 ml', null::text, 25, 0),
         ('200 ml', null::text, 12, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('daily-hydration-serum', 'Daily Hydration Serum', 'skincare', 'Lightweight serum for all-day moisture.', 'A sample serum description. Replace this text with the real product details, including ingredients.', 2600, 'Size', false, '#a8c4b5')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('30 ml', null::text, 2, 0),
         ('50 ml', null::text, 9, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('daily-spf-30-moisturiser', 'Daily SPF 30 Moisturiser', 'skincare', 'Moisturiser and sun protection in one step.', 'A sample SPF moisturiser description. Replace this text with the real product details, including ingredients and SPF information.', 1900, 'Size', false, '#c4d4a8')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('50 ml', null::text, 16, 0)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('whipped-body-butter', 'Whipped Body Butter', 'body', 'Rich, fast-absorbing moisture.', 'A sample body butter description. Replace this text with the real product details, including ingredients.', 1700, 'Size', true, '#c9a3c4')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('200 ml', null::text, 22, 0),
         ('350 ml', null::text, 0, 1)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('sugar-body-scrub', 'Sugar Body Scrub', 'body', 'Smooths and polishes skin.', 'A sample scrub description. Replace this text with the real product details, including ingredients.', 1300, 'Size', false, '#e0b4a8')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('250 g', null::text, 13, 0)
) as v(label, swatch, stock, ord);

with p as (
  insert into public.products (slug, name, category_id, short_description, description, price_pence, option_name, featured, tone)
  values ('glow-body-oil', 'Glow Body Oil', 'body', 'A light oil with a soft shimmer.', 'A sample body oil description. Replace this text with the real product details, including ingredients.', 2000, 'Size', false, '#d9b48a')
  on conflict (slug) do nothing
  returning id
)
insert into public.product_variants (product_id, label, swatch, stock, sort_order)
select p.id, v.label, v.swatch, v.stock, v.ord
from p, (values
         ('100 ml', null::text, 8, 0)
) as v(label, swatch, stock, ord);

