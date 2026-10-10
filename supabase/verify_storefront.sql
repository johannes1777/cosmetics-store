-- ============================================================
-- verify_storefront.sql  -  checks the rules added by 004_storefront_content.sql
-- ============================================================
-- HOW TO USE: run 004 first. Then paste this whole file into the Supabase SQL Editor and Run.
-- It prints a PASS/FAIL report inside a red "error" box. That is EXPECTED: the script ends
-- with an error on purpose so the database undoes all its test data. Nothing is left behind.
-- (It never touches your real content.) Run it again after creating your admin user so the
-- admin checks can run too.
--
-- ABOUT DELETING FILES: Supabase blocks deleting files by running SQL against its storage
-- tables ("use the Storage API instead"). That block also refuses people the rule would refuse,
-- so a plain SQL delete cannot tell the two apart. Section G therefore:
--   (1) reads the delete rule from the live database and checks it EXACTLY: a delete rule for
--       signed-in users only, whose condition is exactly "bucket is storefront AND is_admin()",
--       that calls the real public.is_admin() function, with row level security switched on
--       and no other rule that could allow deletes; and
--   (2) only if Supabase's guard can be stepped aside INSIDE THIS SCRIPT'S OWN ROLLED-BACK
--       TRANSACTION, tries real deletes of a test row as a shopper, a non-admin and an admin.
-- Nothing real is deleted and no rule is changed. If (2) cannot run, the script prints
-- "SKIP  delete behaviour" and the final result says NOT FULLY VERIFIED, even if every other
-- check passed. Test real deletion through the website by hand (see SETUP.md).
--
-- HOW TO READ THE RESULT (printed at the very top AND the very bottom of the report):
--   ALL n CHECKS PASSED                          every check ran and passed
--   n OF m CHECKS FAILED. Do not go live.        something is wrong
--   NOT FULLY VERIFIED — do not go live          something was skipped, so it is untested

create or replace function pg_temp.line(p_label text, p_ok boolean, p_detail text default null)
returns text language sql as $$
  select case when p_ok then 'PASS  ' else 'FAIL  ' end || p_label
    || case when not p_ok and p_detail is not null then E'\n      what happened: ' || left(p_detail, 400) else '' end
    || E'\n'
$$;

-- Runs SQL while pretending to be a role/user. Returns "ok:<result>" or "error:<code>:<message>".
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

-- Runs SQL as the database owner. Returns "ok" or "error:<code>".
create or replace function pg_temp.try_sql(p_sql text)
returns text language plpgsql as $f$
begin
  begin
    execute p_sql;
    return 'ok';
  exception when others then
    return 'error:' || sqlstate;
  end;
end
$f$;

-- "Not allowed" can show up as 0 rows changed OR a permission error. Both mean blocked.
create or replace function pg_temp.blocked(p_res text)
returns boolean language sql as $$
  select p_res = 'ok:0' or p_res like 'error:42501%'
$$;

-- Stricter version for DELETING files. Supabase's own "use the Storage API" guard also fails with
-- code 42501, so that error must NOT count as the rule refusing someone. Only "0 rows deleted" or
-- a genuine permission error counts.
create or replace function pg_temp.refused(p_res text)
returns boolean language sql as $$
  select p_res = 'ok:0'
      or (p_res like 'error:42501%' and p_res not ilike '%direct deletion%' and p_res not ilike '%storage api%')
$$;

do $test$
declare
  r text := '';
  v_u1 text := gen_random_uuid()::text;   -- random file names
  v_u2 text := gen_random_uuid()::text;
  v_u3 text := gen_random_uuid()::text;
  v_p uuid; v_pi uuid; v_other uuid;
  v_admin uuid; v_nobody text := gen_random_uuid()::text;
  v_n integer; v_pass integer; v_fail integer; v_skip integer; v_checks integer;
  v_limit bigint; v_public boolean; v_types text[];
  l text;
  v_u4 text := gen_random_uuid()::text;
  v_bypass boolean := false;      -- true only if this script could really try deleting a file
  v_probe text := '';
  v_res text;
  v_del text := 'with d as (delete from storage.objects where bucket_id = ''storefront'' and name = %L returning 1) select count(*)::text from d';
  rec record;
  v_pol record;                   -- the delete rule, read from the live database
  v_auth oid;                     -- the "authenticated" role
  v_fn regprocedure;              -- the real public.is_admin() function
  v_rls boolean;
  v_norm text;
  v_dep_ok integer; v_dep_other integer;
  v_verdict text;
begin
  -- Test products (rolled back at the end)
  insert into public.categories (id, name) values ('zz-test', 'Test category') on conflict do nothing;
  insert into public.products (slug, name, category_id, price_pence, active)
    values ('zz-sf-active', 'ZZ Active', 'zz-test', 1000, true) returning id into v_p;
  insert into public.products (slug, name, category_id, price_pence, active)
    values ('zz-sf-hidden', 'ZZ Hidden', 'zz-test', 1000, false) returning id into v_pi;
  insert into public.products (slug, name, category_id, price_pence, active)
    values ('zz-sf-other', 'ZZ Other', 'zz-test', 1000, true) returning id into v_other;
  insert into public.product_images (product_id, path, alt, position)
    values (v_p, 'products/' || v_p || '/' || v_u1 || '.jpg', 'Active photo', 0);
  insert into public.product_images (product_id, path, alt, position)
    values (v_pi, 'products/' || v_pi || '/' || v_u2 || '.jpg', 'Hidden photo', 0);
  -- A file that exists in the bucket (inserted by the owner), to test deleting
  insert into storage.objects (bucket_id, name) values ('storefront', 'hero/' || v_u3 || '.png');
  -- Probe: can this script exercise a real DELETE on storage.objects inside its own transaction?
  -- (The switch below is local to this transaction, which is rolled back at the end.)
  insert into storage.objects (bucket_id, name) values ('storefront', 'hero/' || v_u4 || '.png');
  perform set_config('storage.allow_delete_query', 'true', true);
  begin
    delete from storage.objects where bucket_id = 'storefront' and name = 'hero/' || v_u4 || '.png';
    get diagnostics v_n = row_count;
    v_bypass := (v_n = 1);
    if not v_bypass then
      v_probe := 'the delete was accepted but removed ' || v_n || ' rows instead of 1';
    end if;
  exception when others then
    v_bypass := false;
    v_probe := sqlstate || ': ' || sqlerrm;
  end;
  -- Switch Supabase's guard back ON straight away. It is only switched off again, briefly,
  -- inside section G, for the delete tests themselves.
  perform set_config('storage.allow_delete_query', 'false', true);

  -- ===== A. Setup looks right =====
  r := r || E'--- A. Setup ---\n';
  select count(*) into v_n from public.site_content;
  r := r || pg_temp.line('site_content has exactly one row', v_n = 1);
  select count(*) into v_n from public.site_pages;
  r := r || pg_temp.line('site_pages has the 5 pages', v_n = 5);
  select count(*) into v_n from public.home_sections;
  r := r || pg_temp.line('home_sections has the 4 sections', v_n = 4);
  select file_size_limit, public, allowed_mime_types into v_limit, v_public, v_types
    from storage.buckets where id = 'storefront';
  r := r || pg_temp.line('bucket "storefront" exists and is public (so photos can be seen)', coalesce(v_public, false));
  r := r || pg_temp.line('bucket size limit is 5 MB (5242880 bytes)', v_limit = 5242880);
  r := r || pg_temp.line('bucket allows only JPEG, PNG and WebP (no SVG, no GIF)',
    v_types is not null and v_types @> array['image/jpeg','image/png','image/webp'] and cardinality(v_types) = 3);

  -- ===== B. Shoppers (not signed in) =====
  r := r || E'\n--- B. Shoppers (not signed in) ---\n';
  r := r || pg_temp.line('can read the homepage content',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.site_content') = 'ok:1');
  r := r || pg_temp.line('can read the pages',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.site_pages') = 'ok:5');
  r := r || pg_temp.line('can read the section list',
    pg_temp.as_role('anon', null, 'select count(*)::text from public.home_sections') = 'ok:4');
  r := r || pg_temp.line('can see photos of an active product',
    pg_temp.as_role('anon', null, format('select count(*)::text from public.product_images where product_id = %L', v_p)) = 'ok:1');
  r := r || pg_temp.line('CANNOT see photos of a hidden product',
    pg_temp.as_role('anon', null, format('select count(*)::text from public.product_images where product_id = %L', v_pi)) = 'ok:0');
  r := r || pg_temp.line('CANNOT edit homepage content',
    pg_temp.blocked(pg_temp.as_role('anon', null, 'with u as (update public.site_content set hero_headline = ''Hacked'' returning 1) select count(*)::text from u')));
  r := r || pg_temp.line('CANNOT edit a page',
    pg_temp.blocked(pg_temp.as_role('anon', null, 'with u as (update public.site_pages set body = ''Hacked'' returning 1) select count(*)::text from u')));
  r := r || pg_temp.line('CANNOT change the section order',
    pg_temp.blocked(pg_temp.as_role('anon', null, 'with u as (update public.home_sections set visible = false returning 1) select count(*)::text from u')));
  r := r || pg_temp.line('CANNOT add a product photo',
    pg_temp.blocked(pg_temp.as_role('anon', null, format('with i as (insert into public.product_images (product_id, path, alt) values (%L, %L, ''x'') returning 1) select count(*)::text from i', v_p, 'products/' || v_p || '/' || gen_random_uuid() || '.png'))));
  r := r || pg_temp.line('CANNOT upload a file',
    pg_temp.blocked(pg_temp.as_role('anon', null, format('with i as (insert into storage.objects (bucket_id, name) values (''storefront'', %L) returning 1) select count(*)::text from i', 'hero/' || gen_random_uuid() || '.png'))));
  r := r || pg_temp.line('CANNOT list files',
    pg_temp.blocked(pg_temp.as_role('anon', null, 'select count(*)::text from storage.objects where bucket_id = ''storefront''')));

  -- ===== C. Signed in but NOT an admin =====
  r := r || E'\n--- C. Signed-in person who is not an admin ---\n';
  r := r || pg_temp.line('CANNOT edit homepage content',
    pg_temp.blocked(pg_temp.as_role('authenticated', v_nobody, 'with u as (update public.site_content set hero_headline = ''Hacked'' returning 1) select count(*)::text from u')));
  r := r || pg_temp.line('CANNOT edit a page',
    pg_temp.blocked(pg_temp.as_role('authenticated', v_nobody, 'with u as (update public.site_pages set body = ''Hacked'' returning 1) select count(*)::text from u')));
  r := r || pg_temp.line('CANNOT change the section order',
    pg_temp.blocked(pg_temp.as_role('authenticated', v_nobody, 'with u as (update public.home_sections set visible = false returning 1) select count(*)::text from u')));
  r := r || pg_temp.line('CANNOT add a product photo',
    pg_temp.blocked(pg_temp.as_role('authenticated', v_nobody, format('with i as (insert into public.product_images (product_id, path, alt) values (%L, %L, ''x'') returning 1) select count(*)::text from i', v_p, 'products/' || v_p || '/' || gen_random_uuid() || '.png'))));
  r := r || pg_temp.line('CANNOT upload a file',
    pg_temp.blocked(pg_temp.as_role('authenticated', v_nobody, format('with i as (insert into storage.objects (bucket_id, name) values (''storefront'', %L) returning 1) select count(*)::text from i', 'hero/' || gen_random_uuid() || '.png'))));

  -- ===== D. Database limits (checked as the owner, so only the limits are tested) =====
  r := r || E'\n--- D. Button link rules ---\n';
  foreach l in array array['/shop', '/shop?category=lips', 'https://example.com', 'https://example.com/a/b?x=1#top'] loop
    r := r || pg_temp.line('ACCEPTS ' || l, pg_temp.try_sql(format('update public.site_content set hero_button_link = %L', l)) = 'ok');
  end loop;
  foreach l in array array['//evil.com', 'http://example.com', 'javascript:alert(1)', 'mailto:a@b.co', 'https://user@evil.com',
                           '/shop x', ' /shop', 'https://', 'shop', '', 'data:text/html,hi', '//'] loop
    r := r || pg_temp.line('REFUSES "' || l || '"', pg_temp.try_sql(format('update public.site_content set hero_button_link = %L', l)) = 'error:23514');
  end loop;
  r := r || pg_temp.line('REFUSES a backslash (/\evil.com)',
    pg_temp.try_sql(format('update public.site_content set hero_button_link = %L', '/' || chr(92) || 'evil.com')) = 'error:23514');
  r := r || pg_temp.line('REFUSES a tab or newline inside a link',
    pg_temp.try_sql(format('update public.site_content set hero_button_link = %L', '/shop' || chr(9) || 'x')) = 'error:23514'
    and pg_temp.try_sql(format('update public.site_content set hero_button_link = %L', '/shop' || chr(10) || 'x')) = 'error:23514');

  r := r || E'\n--- E. Image reference rules ---\n';
  r := r || pg_temp.line('hero image path with no description is refused',
    pg_temp.try_sql(format('update public.site_content set hero_image_path = %L, hero_image_alt = ''''', 'hero/' || v_u1 || '.png')) = 'error:23514');
  r := r || pg_temp.line('hero image path with a description is accepted',
    pg_temp.try_sql(format('update public.site_content set hero_image_path = %L, hero_image_alt = ''A banner''', 'hero/' || v_u1 || '.png')) = 'ok');
  r := r || pg_temp.line('odd hero path (../ or wrong type) is refused',
    pg_temp.try_sql('update public.site_content set hero_image_path = ''hero/../x.png'', hero_image_alt = ''x''') = 'error:23514'
    and pg_temp.try_sql(format('update public.site_content set hero_image_path = %L, hero_image_alt = ''x''', 'hero/' || v_u1 || '.svg')) = 'error:23514'
    and pg_temp.try_sql(format('update public.site_content set hero_image_path = %L, hero_image_alt = ''x''', 'hero/' || v_u1 || '.gif')) = 'error:23514');
  r := r || pg_temp.line('a page image must sit in that page''s own folder',
    pg_temp.try_sql(format('update public.site_pages set image_path = %L, image_alt = ''x'' where key = ''contact''', 'pages/about/' || v_u1 || '.png')) = 'error:23514'
    and pg_temp.try_sql(format('update public.site_pages set image_path = %L, image_alt = ''x'' where key = ''about''', 'pages/about/' || v_u1 || '.png')) = 'ok');
  r := r || pg_temp.line('a product photo must sit in its own product folder',
    pg_temp.try_sql(format('insert into public.product_images (product_id, path, alt) values (%L, %L, ''x'')', v_p, 'products/' || v_other || '/' || gen_random_uuid() || '.png')) = 'error:23514');
  r := r || pg_temp.line('a product photo must have a description',
    pg_temp.try_sql(format('insert into public.product_images (product_id, path, alt) values (%L, %L, '' '')', v_p, 'products/' || v_p || '/' || gen_random_uuid() || '.png')) = 'error:23514');

  -- ===== F. Admin (only if you have created one) =====
  select user_id into v_admin from public.admins limit 1;
  r := r || E'\n--- F. Admin ---\n';
  if v_admin is null then
    r := r || E'SKIP  no admin exists yet. Create your admin user (see SETUP.md), then run this script again.\n';
  else
    r := r || pg_temp.line('can edit homepage content',
      pg_temp.as_role('authenticated', v_admin::text, 'with u as (update public.site_content set hero_headline = ''Admin test'' returning 1) select count(*)::text from u') = 'ok:1');
    r := r || pg_temp.line('can edit a page',
      pg_temp.as_role('authenticated', v_admin::text, 'with u as (update public.site_pages set body = ''Admin test'' where key = ''about'' returning 1) select count(*)::text from u') = 'ok:1');
    r := r || pg_temp.line('can change the section order and visibility',
      pg_temp.as_role('authenticated', v_admin::text, 'with u as (update public.home_sections set visible = false, position = 9 where key = ''hero'' returning 1) select count(*)::text from u') = 'ok:1');
    r := r || pg_temp.line('can add a product photo',
      pg_temp.as_role('authenticated', v_admin::text, format('with i as (insert into public.product_images (product_id, path, alt, position) values (%L, %L, ''Test'', 1) returning 1) select count(*)::text from i', v_p, 'products/' || v_p || '/' || gen_random_uuid() || '.webp')) = 'ok:1');
    r := r || pg_temp.line('can see photos of a hidden product',
      pg_temp.as_role('authenticated', v_admin::text, format('select count(*)::text from public.product_images where product_id = %L', v_pi)) = 'ok:1');
    r := r || pg_temp.line('CANNOT delete a page or add a second homepage row',
      pg_temp.as_role('authenticated', v_admin::text, 'with d as (delete from public.site_pages returning 1) select count(*)::text from d') like 'error:42501%'
      and pg_temp.as_role('authenticated', v_admin::text, 'with i as (insert into public.site_content (id) values (false) returning 1) select count(*)::text from i') like 'error:%');
    r := r || pg_temp.line('can upload a correctly named file',
      pg_temp.as_role('authenticated', v_admin::text, format('with i as (insert into storage.objects (bucket_id, name) values (''storefront'', %L) returning 1) select count(*)::text from i', 'products/' || v_p || '/' || gen_random_uuid() || '.png')) = 'ok:1');
    r := r || pg_temp.line('CANNOT upload an SVG, a GIF, or a file with a chosen name',
      pg_temp.as_role('authenticated', v_admin::text, format('with i as (insert into storage.objects (bucket_id, name) values (''storefront'', %L) returning 1) select count(*)::text from i', 'hero/' || gen_random_uuid() || '.svg')) like 'error:42501%'
      and pg_temp.as_role('authenticated', v_admin::text, format('with i as (insert into storage.objects (bucket_id, name) values (''storefront'', %L) returning 1) select count(*)::text from i', 'hero/' || gen_random_uuid() || '.gif')) like 'error:42501%'
      and pg_temp.as_role('authenticated', v_admin::text, 'with i as (insert into storage.objects (bucket_id, name) values (''storefront'', ''hero/my-logo.png'') returning 1) select count(*)::text from i') like 'error:42501%'
      and pg_temp.as_role('authenticated', v_admin::text, format('with i as (insert into storage.objects (bucket_id, name) values (''storefront'', %L) returning 1) select count(*)::text from i', 'secret/' || gen_random_uuid() || '.png')) like 'error:42501%');
  end if;

  -- ===== G. Who may delete files =====
  r := r || E'\n--- G. Who may delete files ---\n';

  -- G1. The delete rule, read from the live database and checked EXACTLY (not by looking for words).
  select oid into v_auth from pg_roles where rolname = 'authenticated';
  v_fn := to_regprocedure('public.is_admin()');
  select c.relrowsecurity into v_rls from pg_class c where c.oid = 'storage.objects'::regclass;
  r := r || pg_temp.line('row level security is switched ON for storage.objects (without it no file rule would apply)',
    coalesce(v_rls, false));

  select count(*) into v_n from pg_policy
   where polrelid = 'storage.objects'::regclass and polname = 'Admins delete storefront files';
  r := r || pg_temp.line('exactly one rule named "Admins delete storefront files" exists', v_n = 1,
    'found ' || v_n || ' rule(s) with that name. Run 004_storefront_content.sql.');

  select p.oid as poid, p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual, p.polrelid) as qual
    into v_pol
    from pg_policy p
   where p.polrelid = 'storage.objects'::regclass and p.polname = 'Admins delete storefront files';

  r := r || pg_temp.line('it is a DELETE rule that grants permission (not a restriction, and not a rule for other actions)',
    coalesce(v_pol.polcmd = 'd' and v_pol.polpermissive, false),
    'command=' || coalesce(v_pol.polcmd::text, '?') || ', grants permission=' || coalesce(v_pol.polpermissive::text, '?'));

  r := r || pg_temp.line('it applies only to signed-in users (role "authenticated"), not to shoppers or "public"',
    coalesce(v_pol.polroles = array[v_auth], false),
    'it applies to: ' || coalesce((select string_agg(case when x = 0 then 'public' else x::regrole::text end, ', ')
                                     from unnest(v_pol.polroles) as x), '(nothing found)'));

  -- Take the condition apart: ignore the harmless ::text label, the "public." prefix, spaces and
  -- brackets. What is left must equal exactly one of two spellings. Anything extra (an OR, another
  -- bucket, another function, "AND true") makes it differ and the check fails.
  v_norm := regexp_replace(replace(replace(coalesce(v_pol.qual, ''), '::text', ''), 'public.', ''),
                           '[[:space:]()]', '', 'g');
  r := r || pg_temp.line('its condition is exactly: the bucket is "storefront" AND the person is an admin (nothing more, nothing less)',
    v_norm in ('bucket_id=''storefront''ANDis_admin', 'is_adminANDbucket_id=''storefront'''),
    'the rule actually says: ' || coalesce(v_pol.qual, '(rule not found)'));

  -- The condition must really call the genuine public.is_admin() (not a look-alike function with
  -- the same name in another schema), and no other function.
  select count(*) filter (where d.refobjid = v_fn::oid),
         count(*) filter (where d.refobjid is distinct from v_fn::oid)
    into v_dep_ok, v_dep_other
    from pg_depend d
   where d.classid = 'pg_policy'::regclass and d.objid = v_pol.poid and d.refclassid = 'pg_proc'::regclass;
  r := r || pg_temp.line('it calls the real public.is_admin() function (the check against the admins table), and no other function',
    v_dep_ok >= 1 and v_dep_other = 0,
    'calls to public.is_admin(): ' || v_dep_ok || '; calls to any other function: ' || v_dep_other);

  -- And that function must give the right answers.
  v_res := pg_temp.as_role('authenticated', v_nobody, 'select public.is_admin()::text');
  r := r || pg_temp.line('is_admin() says NO for a signed-in person who is not on the admin list', v_res = 'ok:false', v_res);
  if v_admin is not null then
    v_res := pg_temp.as_role('authenticated', v_admin::text, 'select public.is_admin()::text');
    r := r || pg_temp.line('is_admin() says YES for a person on the admin list', v_res = 'ok:true', v_res);
  end if;

  -- No second rule may let anyone else delete files. (A rule that only restricts is harmless.)
  v_n := 0;
  for rec in
    select p.polname, p.polcmd, p.polroles, pg_get_expr(p.polqual, p.polrelid) as qual
      from pg_policy p
     where p.polrelid = 'storage.objects'::regclass
       and p.polpermissive
       and p.polcmd in ('d', '*')
       and p.polname <> 'Admins delete storefront files'
     order by p.polname
  loop
    v_n := v_n + 1;
    r := r || pg_temp.line('no OTHER rule may allow deleting files, but "' || rec.polname || '" can',
      false,
      'command=' || case rec.polcmd when 'd' then 'DELETE' else 'ALL' end
        || '; applies to: ' || coalesce((select string_agg(case when x = 0 then 'public' else x::regrole::text end, ', ')
                                           from unnest(rec.polroles) as x), '?')
        || '; condition: ' || coalesce(rec.qual, '(none: allows everything)')
        || '. If it belongs to a different bucket, show it to me. Do not go live until it is understood.');
  end loop;
  if v_n = 0 then
    r := r || pg_temp.line('no OTHER rule on storage.objects can allow deleting files', true);
  end if;

  -- G2. Real deletes by role, only if this script could step Supabase's guard aside (see the probe at the top).
  if v_bypass then
    perform set_config('storage.allow_delete_query', 'true', true);
    v_res := pg_temp.as_role('anon', null, format(v_del, 'hero/' || v_u3 || '.png'));
    r := r || pg_temp.line('a shopper (not signed in) cannot delete a file', pg_temp.refused(v_res), v_res);
    v_res := pg_temp.as_role('authenticated', v_nobody, format(v_del, 'hero/' || v_u3 || '.png'));
    r := r || pg_temp.line('a signed-in person who is not an admin cannot delete a file', pg_temp.refused(v_res), v_res);
    select count(*) into v_n from storage.objects where bucket_id = 'storefront' and name = 'hero/' || v_u3 || '.png';
    r := r || pg_temp.line('the file is still there after those refused attempts', v_n = 1);
    if v_admin is null then
      r := r || E'SKIP  admin delete check: no admin exists yet. Create your admin user, then run this script again.\n';
    else
      v_res := pg_temp.as_role('authenticated', v_admin::text, format(v_del, 'hero/' || v_u3 || '.png'));
      r := r || pg_temp.line('an admin can delete a file', v_res = 'ok:1', v_res);
      select count(*) into v_n from storage.objects where bucket_id = 'storefront' and name = 'hero/' || v_u3 || '.png';
      r := r || pg_temp.line('the file is gone after the admin deleted it', v_n = 0);
    end if;
    perform set_config('storage.allow_delete_query', 'false', true);
  else
    r := r || E'SKIP  delete behaviour: Supabase blocks deleting files with SQL, and this script could not step that guard aside, so it did NOT test what shoppers, non-admins and admins can delete. The rule checks above still ran. Test real deletion through the website (SETUP.md, "Testing photo deletion").\n';
    r := r || E'      why it could not run: ' || left(v_probe, 300) || E'\n';
  end if;

  -- ===== The result =====
  -- Any SKIP means something was not tested, so the result can never say "ALL ... PASSED".
  select count(*) into v_pass from regexp_matches(r, '(^|\n)PASS  ', 'g');
  select count(*) into v_fail from regexp_matches(r, '(^|\n)FAIL  ', 'g');
  select count(*) into v_skip from regexp_matches(r, '(^|\n)SKIP  ', 'g');
  v_checks := v_pass + v_fail;

  v_verdict := case
    when v_fail > 0 then v_fail || ' OF ' || v_checks || ' CHECKS FAILED. Do not go live. Send me this report.'
    when v_skip = 0 then 'ALL ' || v_checks || ' CHECKS PASSED'
    else ''
  end;
  if v_skip > 0 then
    v_verdict := v_verdict
      || case when v_fail > 0 then E'\n' else '' end
      || 'NOT FULLY VERIFIED — do not go live. '
      || case when v_fail > 0 then '' else v_pass || ' checks passed, but ' end
      || v_skip || ' check(s) were SKIPPED (see the SKIP lines above), so they have NOT been tested.'
      || case when v_bypass then '' else ' File deletion by role was not tested here: do the website deletion test in SETUP.md.' end;
  end if;

  raise exception E'\n\n=== STOREFRONT CHECK REPORT ===\nRESULT: %\n\n%\nFINAL RESULT: %\n\n(This error is expected. It undoes all test data.)\n',
    v_verdict, r, v_verdict;
end
$test$;
