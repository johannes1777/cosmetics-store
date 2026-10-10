-- ============================================================
-- 002_security.sql  -  who can see and change what (run SECOND)
-- ============================================================
-- Supabase has two "visitor" roles:
--   anon           = anyone on the internet who is not signed in (every shopper)
--   authenticated  = someone signed in (admins, but a signed-in person is NOT automatically an admin)
-- Two layers of protection are used on purpose:
--   1) GRANTS decide which tables/columns a role may touch at all.
--   2) ROW LEVEL SECURITY (RLS) decides which rows within those tables.
-- Both must allow an action, so one mistake cannot open the door by itself.

-- Turn RLS on. With RLS on and no matching rule, the answer is always "no".
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_settings   enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.admins           enable row level security;

-- Supabase hands new tables generous permissions by default. Take them all away first,
-- then give back only what is needed.
revoke all on public.categories, public.products, public.product_variants,
              public.store_settings, public.orders, public.order_items, public.admins
  from anon, authenticated;

-- ---------- The admin check (no "recursion") ----------
-- Policies need to ask "is this person an admin?". If that question was itself answered
-- by a policy on the admins table, the database would loop forever ("infinite recursion").
-- To avoid that: the admins table has NO policies and NO grants (nobody can read it through
-- the website), and this small function reads it directly with the table owner's rights.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''   -- stops anyone tricking the function into using look-alike tables
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- Shoppers (and everyone) can READ the catalogue ----------
grant select on public.categories, public.products, public.product_variants, public.store_settings
  to anon, authenticated;

create policy "Anyone can read categories" on public.categories
  for select to anon, authenticated using (true);

create policy "Anyone can read active products" on public.products
  for select to anon, authenticated using (active);

create policy "Anyone can read variants of active products" on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_variants.product_id and p.active));

create policy "Anyone can read store settings" on public.store_settings
  for select to anon, authenticated using (true);

-- ---------- Admins can manage the catalogue ----------
-- (A shopper has no INSERT/UPDATE/DELETE permission at all. Signed-in non-admins have the
--  permission but the policy below says no, because is_admin() is false.)
grant insert, update, delete on public.categories, public.products, public.product_variants
  to authenticated;

create policy "Admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage variants" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Orders: private ----------
-- Shoppers get NO access to orders. They create orders only through place_order()
-- (003_place_order.sql). Admins can read orders and change ONLY the "status" column:
-- totals, customer details and payment_status cannot be edited from the website.
grant select on public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;

create policy "Admins read orders" on public.orders
  for select to authenticated using (public.is_admin());

create policy "Admins update order status" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins read order items" on public.order_items
  for select to authenticated using (public.is_admin());

-- ---------- Admins list: locked ----------
-- No policies and no grants on public.admins, on purpose. The ONLY way to add an admin
-- is to run SQL in the Supabase SQL Editor yourself, for example:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
--
-- (Do this AFTER creating your admin user in Authentication > Users. See SETUP.md.)
