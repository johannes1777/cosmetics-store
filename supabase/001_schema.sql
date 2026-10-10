-- ============================================================
-- 001_schema.sql  -  creates the tables (run this FIRST, once)
-- ============================================================
-- A "table" is like a spreadsheet tab. Money is always stored in pence
-- (1400 = £14.00) so there are never rounding errors.

create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 1 and 60),
  blurb text not null default '',
  tone text not null default '#b4325f' check (tone ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 120),
  category_id text not null references public.categories (id) on update cascade on delete restrict,
  short_description text not null default '',
  description text not null default '',
  price_pence integer not null check (price_pence between 0 and 1000000),
  option_name text not null default 'Shade' check (char_length(option_name) between 1 and 30),
  featured boolean not null default false,
  active boolean not null default true,
  tone text not null default '#b4325f' check (tone ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per shade or size. Stock lives here.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  swatch text check (swatch is null or swatch ~ '^#[0-9a-fA-F]{6}$'),
  stock integer not null default 0 check (stock >= 0),
  sort_order integer not null default 0,
  unique (product_id, label)
);

-- Delivery prices live in the database so the server can calculate totals itself.
-- This table can only ever hold one row.
create table public.store_settings (
  id boolean primary key default true check (id),
  delivery_standard_pence integer not null default 399 check (delivery_standard_pence >= 0),
  delivery_free_over_pence integer not null default 3000 check (delivery_free_over_pence >= 0)
);
insert into public.store_settings (id) values (true);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new' check (status in ('new', 'packed', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  customer_email text not null check (char_length(customer_email) between 3 and 254),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 30),
  address_line1 text not null check (char_length(address_line1) between 1 and 120),
  address_line2 text check (address_line2 is null or char_length(address_line2) <= 120),
  city text not null check (char_length(city) between 1 and 80),
  postcode text not null check (char_length(postcode) between 5 and 8),
  country text not null default 'United Kingdom',
  subtotal_pence integer not null check (subtotal_pence >= 0),
  delivery_pence integer not null check (delivery_pence >= 0),
  total_pence integer not null check (total_pence >= 0),
  created_at timestamptz not null default now(),
  check (total_pence = subtotal_pence + delivery_pence)
);

-- A snapshot of what was bought, so old orders stay correct if a product changes later.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  option_label text not null,
  unit_price_pence integer not null check (unit_price_pence >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_pence integer not null check (line_pence >= 0)
);

-- The list of people allowed into the admin area. Nobody can change it through
-- the website; only you, in the Supabase SQL Editor (see 002_security.sql).
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index variants_product_idx on public.product_variants (product_id);
create index order_items_order_idx on public.order_items (order_id);
create index orders_created_idx on public.orders (created_at desc);

-- Keeps products.updated_at correct automatically.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
