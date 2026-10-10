-- ============================================================
-- verify_security.sql  -  checks that the security rules really work
-- ============================================================
-- HOW TO USE: paste this whole file into the Supabase SQL Editor and click Run.
-- It tries things a shopper, a signed-in non-admin, and an admin should and should
-- NOT be able to do, and prints a PASS/FAIL report.
--
-- IMPORTANT: the result appears as a red "error" box. That is expected! The script
-- ends with an error ON PURPOSE because that makes the database undo all of its test
-- data (test products, test orders, stock changes). Nothing is left behind.
-- Read the report inside the box. It ends with "ALL n CHECKS PASSED" if all is well.
--
-- Run it again after you create your admin user to also test the admin checks.

create or replace function pg_temp.line(p_label text, p_ok boolean)
returns text language sql as $$
  select case when p_ok then 'PASS  ' else 'FAIL  ' end || p_label || E'\n'
$$;

-- Runs one SQL statement while pretending to be a given role/user, and reports
-- either "ok:<result>" or "error:<code>:<message>".
create or replace function pg_temp.as_role(p_role text, p_sub text, p_sql text)
returns text language plpgsql as $f$
declare v_out text;
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_sub is null then '' else json_build_object('sub', p_sub, 'role', p_role)::text end, true);
    execute format('set local role %I', p_role);
    execute p_sql into v_out;
    reset role;
    return 'ok:' || coalesce(v_out, 'null');
  exception when others then
    return 'error:' || sqlstate || ':' || sqlerrm;
  end;
end
$f$;

-- Builds a place_order(...) call with fake customer details.
create or replace function pg_temp.po(p_items text, p_email text default 'tester@example.com')
returns text language sql as $$
  select format('select public.place_order(%L,%L,%L,%L,%L,%L,%L,%L::jsonb)::text',
    'Test Customer', p_email, '07000 000000', '1 Test Street', null, 'Testville', 'SW1A 1AA', p_items)
$$;

do $test$
declare
  r text := '';
  v_p uuid; v_v uuid; v_pi uuid; v_vi uuid;
  v_admin uuid; v_nobody text := gen_random_uuid()::text;
  v_res text; v_n integer; v_fail integer;
  v_std integer; v_free integer; v_expected integer;
  v_unit integer; v_status text; v_pay text;
  v_checks integer;
begin
  -- Test data: one active product and one hidden product, 5 in stock each.
  insert into public.categories (id, name) values ('zz-test', 'Test category') on conflict do nothing;
  insert into public.products (slug, name, category_id, price_pence, option_name, active)
    values ('zz-test-active', 'ZZ Test Active', 'zz-test', 1000, 'Size', true) returning id into v_p;
  insert into public.product_variants (product_id, label, stock) values (v_p, 'Small', 5) returning id into v_v;
  insert into public.products (slug, name, category_id, price_pence, option_name, active)
    values ('zz-test-hidden', 'ZZ Test Hidden', 'zz-test', 1000, 'Size', false) returning id into v_pi;
  insert into public.product_variants (product_id, label, stock) values (v_pi, 'Small', 5) returning id into v_vi;
  select delivery_standard_pence, delivery_free_over_pence into v_std, v_free from public.store_settings;

  -- ===== A. Shoppers who are not signed in (role: anon) =====
  r := r || E'--- A. Shoppers (not signed in) ---\n';
  r := r || pg_temp.line('can read categories',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.categories') like 'ok:%');
  r := r || pg_temp.line('can see an active product',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.products where slug = ''zz-test-active''') = 'ok:1');
  r := r || pg_temp.line('CANNOT see a hidden product',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.products where slug = ''zz-test-hidden''') = 'ok:0');
  r := r || pg_temp.line('can see options of an active product',
    pg_temp.as_role('anon', null, format('select count(*)::text from public.product_variants where id = %L', v_v)) = 'ok:1');
  r := r || pg_temp.line('CANNOT see options of a hidden product',
    pg_temp.as_role('anon', null, format('select count(*)::text from public.product_variants where id = %L', v_vi)) = 'ok:0');
  r := r || pg_temp.line('CANNOT read orders',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.orders') like 'error:42501%');
  r := r || pg_temp.line('CANNOT read order items',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.order_items') like 'error:42501%');
  r := r || pg_temp.line('CANNOT read the admins list',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.admins') like 'error:42501%');
  r := r || pg_temp.line('CANNOT insert an order directly',
    pg_temp.as_role('anon', null, 'with i as (insert into public.orders (reference, customer_name, customer_email, address_line1, city, postcode, subtotal_pence, delivery_pence, total_pence) values (''X'',''x'',''x@x.xx'',''a'',''b'',''SW1A 1AA'',0,0,0) returning 1) select count(*)::text from i') like 'error:42501%');
  r := r || pg_temp.line('CANNOT change stock',
    pg_temp.as_role('anon', null, format('with u as (update public.product_variants set stock = 999 where id = %L returning 1) select count(*)::text from u', v_v)) like 'error:42501%');
  r := r || pg_temp.line('CANNOT change a price',
    pg_temp.as_role('anon', null, format('with u as (update public.products set price_pence = 1 where id = %L returning 1) select count(*)::text from u', v_p)) like 'error:42501%');
  r := r || pg_temp.line('CANNOT add a product',
    pg_temp.as_role('anon', null, 'with i as (insert into public.products (slug, name, category_id, price_pence) values (''zz-x'',''x'',''zz-test'',1) returning 1) select count(*)::text from i') like 'error:42501%');
  r := r || pg_temp.line('CANNOT call is_admin()',
    pg_temp.as_role('anon', null, 'select public.is_admin()::text') like 'error:42501%');

  -- ===== B. place_order =====
  r := r || E'\n--- B. place_order (the only way to create an order) ---\n';
  -- The browser "lies" about the price (price_pence: 1). It must be ignored.
  v_res := pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":2,"price_pence":1}]', v_p, v_v)));
  r := r || pg_temp.line('a valid order succeeds', v_res like 'ok:%ORD-%');

  select o.total_pence, o.status, o.payment_status into v_n, v_status, v_pay
    from public.orders o where o.customer_email = 'tester@example.com' order by o.created_at desc limit 1;
  v_expected := 2000 + case when 2000 >= v_free then 0 else v_std end;
  r := r || pg_temp.line('total is calculated from database prices (ignores browser price)', v_n = v_expected);
  select oi.unit_price_pence into v_unit from public.order_items oi where oi.product_id = v_p limit 1;
  r := r || pg_temp.line('saved item price is the database price (1000), not 1', v_unit = 1000);
  r := r || pg_temp.line('order is saved as status new and UNPAID', v_status = 'new' and v_pay = 'unpaid');
  select stock into v_n from public.product_variants where id = v_v;
  r := r || pg_temp.line('stock went down from 5 to 3', v_n = 3);

  r := r || pg_temp.line('rejects an unknown option id',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":1}]', v_p, gen_random_uuid()))) like '%ERR_ITEM_UNAVAILABLE%');
  r := r || pg_temp.line('rejects an option that belongs to a different product',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":1}]', v_p, v_vi))) like '%ERR_ITEM_UNAVAILABLE%');
  r := r || pg_temp.line('rejects a hidden (inactive) product',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":1}]', v_pi, v_vi))) like '%ERR_ITEM_UNAVAILABLE%');
  r := r || pg_temp.line('rejects quantity 0',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":0}]', v_p, v_v))) like '%ERR_INVALID_ITEMS%');
  r := r || pg_temp.line('rejects quantity 11',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":11}]', v_p, v_v))) like '%ERR_INVALID_ITEMS%');
  r := r || pg_temp.line('rejects quantity written as text',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":"2"}]', v_p, v_v))) like '%ERR_INVALID_ITEMS%');
  r := r || pg_temp.line('rejects the same option split into lines that add up past 10',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":6},{"product_id":"%s","variant_id":"%s","quantity":6}]', v_p, v_v, v_p, v_v))) like '%ERR_INVALID_ITEMS%');
  r := r || pg_temp.line('rejects asking for more than the stock left (4 > 3)',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":4}]', v_p, v_v))) like '%ERR_OUT_OF_STOCK%');
  r := r || pg_temp.line('rejects a basket that is not a list',
    pg_temp.as_role('anon', null, pg_temp.po('{"a":1}')) like '%ERR_INVALID_ITEMS%');
  r := r || pg_temp.line('rejects an empty basket',
    pg_temp.as_role('anon', null, pg_temp.po('[]')) like '%ERR_INVALID_ITEMS%');
  r := r || pg_temp.line('rejects a bad email address',
    pg_temp.as_role('anon', null, pg_temp.po(format('[{"product_id":"%s","variant_id":"%s","quantity":1}]', v_p, v_v), 'not-an-email')) like '%ERR_INVALID_DETAILS%');
  select stock into v_n from public.product_variants where id = v_v;
  r := r || pg_temp.line('rejected orders left stock untouched (still 3)', v_n = 3);

  -- ===== C. Signed in, but NOT an admin =====
  r := r || E'\n--- C. Signed-in person who is not an admin ---\n';
  r := r || pg_temp.line('is_admin() says false',
    pg_temp.as_role('authenticated', v_nobody, 'select public.is_admin()::text') = 'ok:false');
  r := r || pg_temp.line('sees zero orders (the test order is hidden from them)',
    pg_temp.as_role('authenticated', v_nobody, 'select count(*)::text from public.orders') = 'ok:0');
  r := r || pg_temp.line('CANNOT change stock (0 rows changed)',
    pg_temp.as_role('authenticated', v_nobody, format('with u as (update public.product_variants set stock = 999 where id = %L returning 1) select count(*)::text from u', v_v)) = 'ok:0');
  r := r || pg_temp.line('CANNOT add a product',
    pg_temp.as_role('authenticated', v_nobody, 'with i as (insert into public.products (slug, name, category_id, price_pence) values (''zz-y'',''y'',''zz-test'',1) returning 1) select count(*)::text from i') like 'error:42501%');
  r := r || pg_temp.line('CANNOT make themselves an admin',
    pg_temp.as_role('authenticated', v_nobody, format('with i as (insert into public.admins (user_id) values (%L) returning 1) select count(*)::text from i', v_nobody::uuid)) like 'error:42501%');

  -- ===== D. Admin (only if you have created one) =====
  select user_id into v_admin from public.admins limit 1;
  r := r || E'\n--- D. Admin ---\n';
  if v_admin is null then
    r := r || E'SKIP  no admin exists yet. Create your admin user (see SETUP.md), then run this script again.\n';
  else
    r := r || pg_temp.line('is_admin() says true',
      pg_temp.as_role('authenticated', v_admin::text, 'select public.is_admin()::text') = 'ok:true');
    r := r || pg_temp.line('can read orders',
      pg_temp.as_role('authenticated', v_admin::text, 'select count(*)::text from public.orders') not in ('ok:0') and
      pg_temp.as_role('authenticated', v_admin::text, 'select count(*)::text from public.orders') like 'ok:%');
    r := r || pg_temp.line('can change an order status',
      pg_temp.as_role('authenticated', v_admin::text, 'with u as (update public.orders set status = ''packed'' where customer_email = ''tester@example.com'' returning 1) select count(*)::text from u') = 'ok:1');
    r := r || pg_temp.line('CANNOT mark an order paid',
      pg_temp.as_role('authenticated', v_admin::text, 'with u as (update public.orders set payment_status = ''paid'' where customer_email = ''tester@example.com'' returning 1) select count(*)::text from u') like 'error:42501%');
    r := r || pg_temp.line('CANNOT edit an order total',
      pg_temp.as_role('authenticated', v_admin::text, 'with u as (update public.orders set total_pence = 1 where customer_email = ''tester@example.com'' returning 1) select count(*)::text from u') like 'error:42501%');
    r := r || pg_temp.line('CANNOT delete an order',
      pg_temp.as_role('authenticated', v_admin::text, 'with d as (delete from public.orders where customer_email = ''tester@example.com'' returning 1) select count(*)::text from d') like 'error:42501%');
    r := r || pg_temp.line('can change a product price',
      pg_temp.as_role('authenticated', v_admin::text, format('with u as (update public.products set price_pence = 1200 where id = %L returning 1) select count(*)::text from u', v_p)) = 'ok:1');
    r := r || pg_temp.line('can see a hidden product',
      pg_temp.as_role('authenticated', v_admin::text, 'select count(*)::text from public.products where slug = ''zz-test-hidden''') = 'ok:1');
    r := r || pg_temp.line('CANNOT read or edit the admins list through the website',
      pg_temp.as_role('authenticated', v_admin::text, 'select count(*)::text from public.admins') like 'error:42501%');
  end if;

  -- Summary, then fail on purpose so everything above is undone.
  v_fail := (length(r) - length(replace(r, 'FAIL  ', ''))) / 6;
  v_checks := (length(r) - length(replace(r, 'PASS  ', ''))) / 6 + v_fail;
  raise exception E'\n\n=== SECURITY CHECK REPORT ===\n%\n%\n(This error is expected. It undoes all test data.)\n',
    r,
    case when v_fail = 0 then 'ALL ' || v_checks || ' CHECKS PASSED' else v_fail || ' OF ' || v_checks || ' CHECKS FAILED. Do not go live. Send me this report.' end;
end
$test$;
