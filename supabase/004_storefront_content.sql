-- ============================================================
-- 004_storefront_content.sql  -  editable homepage, pages and photos
-- ============================================================
-- Run this ONCE in the Supabase SQL Editor (after 001, 002 and 003 have been run).
-- You do NOT need to re-run or change any earlier file.
--
-- IT IS SAFE TO RUN AGAIN. Tables are only created if they are missing, the starter
-- text is only inserted if a row does not exist yet (so anything you have edited is
-- NEVER overwritten), and rules are dropped and re-created identically. The only
-- thing a re-run resets is the image bucket's SAFETY settings (5 MB, JPEG/PNG/WebP
-- only), on purpose, so nobody can leave them loosened by accident.
--
-- What it adds:
--   * site_content   - the homepage banner text/button/image and the contact details
--   * site_pages     - the text and image of the About, Contact, Delivery, Returns, Privacy pages
--   * home_sections  - which homepage sections show, and in what order
--   * product_images - the photos of each product
--   * a public image bucket called "storefront" that only admins can change

-- ---------- 0. Safety check: the earlier scripts must have been run ----------
do $$
begin
  if to_regclass('public.products') is null
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Please run 001_schema.sql, 002_security.sql and 003_place_order.sql first. This file builds on them.';
  end if;
  if to_regclass('storage.buckets') is null then
    raise exception 'Supabase Storage does not seem to be available in this project.';
  end if;
end
$$;

-- ---------- 1. Tables ----------
-- Images are stored in the bucket; these tables hold only the file's PATH (its name
-- inside the bucket). The path pattern is strict, so nothing odd can be saved.

create table if not exists public.site_content (
  id boolean primary key default true check (id),   -- always exactly one row
  hero_headline text not null default 'Find your shade. Keep your routine simple.'
    check (char_length(btrim(hero_headline)) between 1 and 120),
  hero_text text not null
    default '{{brand_name}} makes lip, face, skin and body essentials in colours and formulas made for every day.'
    check (char_length(hero_text) <= 400),
  hero_button_label text not null default 'Shop all products'
    check (char_length(btrim(hero_button_label)) between 1 and 40),
  hero_button_link text not null default '/shop',
  hero_image_path text
    check (hero_image_path is null or hero_image_path ~ '^hero/[0-9a-f-]{36}[.](jpg|png|webp)$'),
  hero_image_alt text not null default '' check (char_length(hero_image_alt) <= 200),
  contact_email text not null default 'hello@example.com'
    check (char_length(contact_email) <= 254 and contact_email ~ '^[^@ ]+@[^@ ]+[.][^@ ]+$'),
  contact_phone text not null default '00000 000000' check (char_length(contact_phone) <= 40),
  contact_hours text not null default 'Mon to Fri, 9am to 5pm (placeholder)' check (char_length(contact_hours) <= 100),
  contact_address text not null default E'1 Placeholder Street\nPlaceholder Town\nAB1 2CD'
    check (char_length(contact_address) <= 300),
  updated_at timestamptz not null default now(),
  -- A picture must always have a description (for screen readers)
  constraint site_content_hero_alt_needed
    check (hero_image_path is null or char_length(btrim(hero_image_alt)) > 0),
  -- Button link: EITHER a path inside the shop ("/shop"), but never "//..." (which would
  -- jump to another website), OR a full https:// address. No spaces, control characters or
  -- backslashes. http://, javascript:, mailto: and so on are all refused.
  constraint site_content_link_safe check (
    char_length(hero_button_link) between 1 and 300
    and hero_button_link !~ '[[:cntrl:][:space:]]'
    and strpos(hero_button_link, E'\\') = 0
    and (
      (hero_button_link ~ '^/' and hero_button_link !~ '^//')
      or hero_button_link ~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#].*)?$'
    )
  )
);

create table if not exists public.site_pages (
  key text primary key check (key in ('about', 'contact', 'delivery', 'returns', 'privacy')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null default '' check (char_length(body) <= 8000),
  image_path text,
  image_alt text not null default '' check (char_length(image_alt) <= 200),
  updated_at timestamptz not null default now(),
  constraint site_pages_image_path_ok check (
    image_path is null
    or (image_path ~ '^pages/[a-z]+/[0-9a-f-]{36}[.](jpg|png|webp)$'
        and position(('pages/' || key || '/') in image_path) = 1)
  ),
  constraint site_pages_alt_needed check (image_path is null or char_length(btrim(image_alt)) > 0)
);

create table if not exists public.home_sections (
  key text primary key check (key in ('hero', 'categories', 'featured', 'promise')),
  visible boolean not null default true,
  position integer not null check (position between 1 and 100)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null unique
    check (path ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'),
  alt text not null check (char_length(btrim(alt)) between 1 and 200),
  position integer not null default 0 check (position between 0 and 100),
  created_at timestamptz not null default now(),
  -- the file must live in this product's own folder
  constraint product_images_in_own_folder
    check (position(('products/' || product_id::text || '/') in path) = 1)
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- Keep updated_at correct (uses the helper from 001_schema.sql)
drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at before update on public.site_content
  for each row execute function public.set_updated_at();
drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at before update on public.site_pages
  for each row execute function public.set_updated_at();

-- ---------- 2. Starter content (never overwrites what you have edited) ----------
-- "on conflict do nothing" means: if the row already exists, leave it exactly as it is.
-- Words in {{double braces}} are filled in by the website (for example the delivery price).
insert into public.site_content (id) values (true) on conflict (id) do nothing;

insert into public.home_sections (key, visible, position) values
  ('hero', true, 1), ('categories', true, 2), ('featured', true, 3), ('promise', true, 4)
on conflict (key) do nothing;

insert into public.site_pages (key, title, body) values
('about', 'About us', $body${{brand_name}} is a sample cosmetics brand used to demonstrate this store template. Replace this page with the real story: who makes the products, what you care about, and why customers can trust you.

Good about pages say where products are made, how they are tested, and what makes the range different. Keep it short and specific.$body$),
('contact', 'Contact us', $body$Questions about an order or a product? Get in touch using the details below.$body$),
('delivery', 'Delivery', $body$## Where we deliver
We deliver to addresses in the {{country}}.

## Cost and timing
- Standard delivery costs {{delivery_price}} and takes {{delivery_estimate}}.
- Delivery is free on orders over {{free_delivery_threshold}}.

The delivery cost is shown in your basket and at checkout before you order.$body$),
('returns', 'Returns', $body$## Our returns promise
You can return unopened items within {{returns_days}} days of receiving them for a refund. For hygiene reasons we cannot accept opened lip, eye or skincare products unless they are faulty.

## How to return an item
Email {{contact_email}} with your order reference and we will send you the steps.

## Your legal rights
This does not affect your statutory rights. Add the cancellation and faulty-goods wording your business is required to show customers.$body$),
('privacy', 'Privacy', $body$## What we collect
When you place an order we collect your name, email address, delivery address and, if you choose to give it, your phone number. We collect only what we need to deliver your order and contact you about it.

## How we use it
We use your details to process and deliver orders, and to answer questions about them.

## Your rights
You can ask to see, correct or delete the personal information we hold about you by emailing {{contact_email}}.

Add your legal business name, how long you keep data, which services process it, and how customers can complain to the Information Commissioner's Office.$body$)
on conflict (key) do nothing;

-- ---------- 3. Who can see and change the new tables ----------
-- Same two layers as before: grants (what a role may touch) AND row level security
-- (which rows). Shoppers can only READ. Only people listed in the admins table can change anything.
alter table public.site_content   enable row level security;
alter table public.site_pages     enable row level security;
alter table public.home_sections  enable row level security;
alter table public.product_images enable row level security;

revoke all on public.site_content, public.site_pages, public.home_sections, public.product_images
  from anon, authenticated;

grant select on public.site_content, public.site_pages, public.home_sections, public.product_images
  to anon, authenticated;
grant update on public.site_content, public.site_pages to authenticated;          -- rows already exist; none can be added or deleted
grant insert, update on public.home_sections to authenticated;                    -- cannot be deleted
grant insert, update, delete on public.product_images to authenticated;

drop policy if exists "Anyone can read site content" on public.site_content;
create policy "Anyone can read site content" on public.site_content
  for select to anon, authenticated using (true);
drop policy if exists "Admins edit site content" on public.site_content;
create policy "Admins edit site content" on public.site_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read site pages" on public.site_pages;
create policy "Anyone can read site pages" on public.site_pages
  for select to anon, authenticated using (true);
drop policy if exists "Admins edit site pages" on public.site_pages;
create policy "Admins edit site pages" on public.site_pages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read home sections" on public.home_sections;
create policy "Anyone can read home sections" on public.home_sections
  for select to anon, authenticated using (true);
drop policy if exists "Admins add home sections" on public.home_sections;
create policy "Admins add home sections" on public.home_sections
  for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins edit home sections" on public.home_sections;
create policy "Admins edit home sections" on public.home_sections
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Photos of hidden products are not listed to shoppers (same idea as product options).
drop policy if exists "Anyone can read photos of active products" on public.product_images;
create policy "Anyone can read photos of active products" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id and p.active));
drop policy if exists "Admins manage product photos" on public.product_images;
create policy "Admins manage product photos" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. The image bucket ----------
-- "public" = anyone with a picture's web address can SEE it (that is what a shop needs).
-- The size limit and allowed file types are enforced by Supabase itself on every upload.
-- SVG is deliberately NOT allowed because SVG files can contain scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storefront', 'storefront', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Rules for the files themselves. Note what is NOT here:
--   * no rule lets shoppers upload, list or delete (public viewing needs no rule);
--   * no UPDATE rule, so an existing file can never be overwritten. "Replace" in the
--     admin uploads a new file under a new random name and then deletes the old one.
drop policy if exists "Admins list storefront files" on storage.objects;
create policy "Admins list storefront files" on storage.objects
  for select to authenticated
  using (bucket_id = 'storefront' and public.is_admin());

drop policy if exists "Admins upload storefront files" on storage.objects;
create policy "Admins upload storefront files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'storefront'
    and public.is_admin()
    -- only these folders, only random-looking names, only these extensions
    and name ~ '^(hero|pages/(about|contact|delivery|returns|privacy)|products/[0-9a-f-]{36})/[0-9a-f-]{36}[.](jpg|png|webp)$'
  );

drop policy if exists "Admins delete storefront files" on storage.objects;
create policy "Admins delete storefront files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'storefront' and public.is_admin());
