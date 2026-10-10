-- ============================================================
-- 003_place_order.sql  -  the ONLY way a shopper can create an order (run THIRD)
-- ============================================================
-- The browser sends: delivery details + a list of {product_id, variant_id, quantity}.
-- It does NOT send prices. This function looks up every price itself, checks every ID,
-- locks the stock rows while it works (so two shoppers cannot buy the last item),
-- and returns only the order reference and totals.
--
-- Hardening notes:
--  * SECURITY DEFINER: it runs with the owner's rights so it can write orders, because
--    shoppers have no direct access to the orders table.
--  * set search_path = '': every table is written as public.xxx, so nobody can slip in a
--    look-alike table or function.
--  * EXECUTE is revoked from everyone and granted back only to anon + authenticated.
--  * Every input is checked before anything is written, and any error undoes everything
--    (including stock changes) because the whole function is one transaction.

create or replace function public.place_order(
  p_full_name text,
  p_email     text,
  p_phone     text,
  p_address1  text,
  p_address2  text,
  p_city      text,
  p_postcode  text,
  p_items     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text := btrim(coalesce(p_full_name, ''));
  v_email    text := btrim(coalesce(p_email, ''));
  v_phone    text := nullif(btrim(coalesce(p_phone, '')), '');
  v_addr1    text := btrim(coalesce(p_address1, ''));
  v_addr2    text := nullif(btrim(coalesce(p_address2, '')), '');
  v_city     text := btrim(coalesce(p_city, ''));
  v_pc_raw   text := upper(regexp_replace(coalesce(p_postcode, ''), '[[:space:]]+', '', 'g'));
  v_postcode text;
  v_elem     jsonb;
  v_rec      record;
  v_row      record;
  v_settings record;
  v_lines    jsonb := '[]'::jsonb;
  v_line     integer;
  v_subtotal integer := 0;
  v_delivery integer;
  v_order_id uuid;
  v_reference text;
  v_attempt  integer := 0;
begin
  -- 1. Check the delivery details -------------------------------------------
  if char_length(v_name) not between 1 and 100
     or char_length(v_email) > 254
     or v_email !~ '^[^@ ]+@[^@ ]+[.][^@ ]+$'
     or (v_phone is not null and (char_length(v_phone) > 30 or v_phone !~ '^[+0-9][0-9 ()-]{6,}$'))
     or char_length(v_addr1) not between 1 and 120
     or (v_addr2 is not null and char_length(v_addr2) > 120)
     or char_length(v_city) not between 1 and 80
     or v_pc_raw !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$'
  then
    raise exception 'ERR_INVALID_DETAILS';
  end if;
  v_postcode := left(v_pc_raw, char_length(v_pc_raw) - 3) || ' ' || right(v_pc_raw, 3);

  -- 2. Check the shape of the basket ----------------------------------------
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 20
  then
    raise exception 'ERR_INVALID_ITEMS';
  end if;

  for v_elem in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_elem) <> 'object'
       or coalesce(v_elem ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v_elem ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_elem -> 'quantity') is distinct from 'number'
       or coalesce(v_elem ->> 'quantity', '') !~ '^[0-9]{1,2}$'
    then
      raise exception 'ERR_INVALID_ITEMS';
    end if;
    if (v_elem ->> 'quantity')::integer not between 1 and 10 then
      raise exception 'ERR_INVALID_ITEMS';
    end if;
  end loop;

  -- 3. Look up prices, check stock and LOCK each stock row ------------------
  -- Lines are processed in a fixed order (by variant id) so two orders at the
  -- same moment can never block each other forever. If the same option appears
  -- twice, the quantities are added together.
  for v_rec in
    select (e ->> 'product_id')::uuid as product_id,
           (e ->> 'variant_id')::uuid as variant_id,
           sum((e ->> 'quantity')::integer) as qty
    from jsonb_array_elements(p_items) as e
    group by 1, 2
    order by 2
  loop
    if v_rec.qty > 10 then
      raise exception 'ERR_INVALID_ITEMS';
    end if;

    -- "for update of v" locks this variant row until the order is finished.
    select v.id as variant_id, v.label, v.stock,
           p.id as product_id, p.name, p.price_pence, p.option_name
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = v_rec.variant_id
       and p.id = v_rec.product_id      -- the option must belong to this product
       and p.active                     -- hidden products cannot be bought
       for update of v;

    if not found then
      raise exception 'ERR_ITEM_UNAVAILABLE';
    end if;

    if v_row.stock < v_rec.qty then
      raise exception 'ERR_OUT_OF_STOCK:%', v_row.name;
    end if;

    update public.product_variants
       set stock = stock - v_rec.qty::integer
     where id = v_row.variant_id;

    v_line := v_row.price_pence * v_rec.qty::integer;   -- the price comes from the database, never the browser
    v_subtotal := v_subtotal + v_line;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_row.product_id,
      'variant_id', v_row.variant_id,
      'name', v_row.name,
      'option', v_row.option_name || ': ' || v_row.label,
      'unit_price_pence', v_row.price_pence,
      'quantity', v_rec.qty,
      'line_pence', v_line
    ));
  end loop;

  -- 4. Delivery cost, also decided here -------------------------------------
  select delivery_standard_pence, delivery_free_over_pence
    into v_settings
    from public.store_settings
   where id;

  v_delivery := case
    when v_subtotal >= v_settings.delivery_free_over_pence then 0
    else v_settings.delivery_standard_pence
  end;

  -- 5. Save the order (unpaid) with a short random reference ----------------
  loop
    v_attempt := v_attempt + 1;
    v_reference := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.orders (
        reference, customer_name, customer_email, customer_phone,
        address_line1, address_line2, city, postcode,
        subtotal_pence, delivery_pence, total_pence
      ) values (
        v_reference, v_name, v_email, v_phone,
        v_addr1, v_addr2, v_city, v_postcode,
        v_subtotal, v_delivery, v_subtotal + v_delivery
      )
      returning id into v_order_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'ERR_TRY_AGAIN';
      end if;
    end;
  end loop;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, option_label,
    unit_price_pence, quantity, line_pence
  )
  select v_order_id,
         (l ->> 'product_id')::uuid,
         (l ->> 'variant_id')::uuid,
         l ->> 'name',
         l ->> 'option',
         (l ->> 'unit_price_pence')::integer,
         (l ->> 'quantity')::integer,
         (l ->> 'line_pence')::integer
    from jsonb_array_elements(v_lines) as l;

  return jsonb_build_object(
    'reference', v_reference,
    'subtotal_pence', v_subtotal,
    'delivery_pence', v_delivery,
    'total_pence', v_subtotal + v_delivery,
    'lines', v_lines
  );
end;
$$;

-- Who may call it: only the website visitors (anon) and signed-in users.
revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb)
  to anon, authenticated;
