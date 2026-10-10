# Stage 2 setup guide (beginner friendly)

You will do four things: connect the site to Supabase, create the database, create your one admin
account, and test it. Take it slowly. Nothing here can break your computer, and the SQL only
touches your own Supabase project.

**Use made-up customer details for every test** (for example "Test Customer", test@example.com,
1 Test Street, SW1A 1AA). Never type real people's details while testing.

---

## Step 1. Connect the site to Supabase

1. Open a terminal in the project folder (the one containing `package.json`).
2. If this folder is not a git repository yet, run `git init`. Do this **before** creating the next
   file, so the "ignore" rule is active from the start.
3. Create a file named `.env.local` in that same folder, with exactly these two lines
   (use your own values from Supabase, in Project Settings, under the API / API Keys page):

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key-here
   ```

4. Check the key. It must start with `sb_publishable_` (or be your project's older "anon" key).
   **Never** use a key that starts with `sb_secret_` or is called `service_role`. Anything starting
   with `VITE_` is visible to every visitor of your website.
5. Check git will ignore the file: run `git check-ignore -v .env.local`. It should print a line
   mentioning `.gitignore`. If it prints nothing, stop and tell me.
6. If you ever accidentally upload a secret key to GitHub, go to Supabase and create a new one,
   then delete the old one. Removing it from GitHub is not enough.

## Step 2. Create the database

In the Supabase dashboard open **SQL Editor** and click **New query**. For each file below, open the
file on your computer, copy **everything**, paste it into the editor, and click **Run**.
Do them **in this order**, one at a time:

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/001_schema.sql` | Creates the tables (your shop's "spreadsheet tabs") |
| 2 | `supabase/002_security.sql` | Locks everything down: who can see and change what |
| 3 | `supabase/003_place_order.sql` | Creates the one safe way to place an order |
| 4 | `supabase/seed.sql` | Optional. Adds 12 made-up sample products |

Each should finish with a message like "Success. No rows returned". If you see a red error, copy the
whole message and send it to me. Do not run the files twice (001 will complain that tables exist).

## Step 3. Create your one admin account

1. **Turn off public sign-ups.** In Supabase go to Authentication, then the sign-in / providers
   settings, and switch off "Allow new users to sign up". (Menu names change over time, so look for
   that wording.) This stops strangers creating accounts. Even if someone did, an account is **not**
   an admin until you add it to the list in step 4.
2. **Create your admin user.** Authentication, then Users, then "Add user" (create a new user).
   Enter your own email and a long, unique password, and choose the option that confirms the email
   automatically so you can sign in straight away.
3. **Put yourself on the admin list.** Back in the SQL Editor, run this, replacing the email with the
   one you just used:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   It should say "Success. 1 row affected". If it says 0 rows, the email does not match.

Only you can do step 3.3, because the website itself has no permission to touch the admin list.

## Step 4. Check the security rules

1. Open `supabase/verify_security.sql`, copy everything, paste it into a new SQL Editor query and Run.
2. **You will see a red error box. That is expected.** The script ends with an error on purpose so the
   database automatically undoes its test data. The report is inside the box.
3. Every line should start with `PASS`. The last line should say `ALL ... CHECKS PASSED`.
4. If any line says `FAIL`, do not go on. Send me the whole report.
5. If the Admin section says `SKIP`, you ran it before step 3. Run it again now.

## Step 5. Run the site and try it

1. `npm install` (once), then `npm run dev`, then open the address it prints.
2. **As a shopper:** browse, add things to your basket, and place a test order with made-up details.
   You should reach the confirmation page, and the stock for that item should go down.
3. **As the admin:** go to `/admin` (type it into the address bar, for example http://localhost:5173/admin).
   Sign in with the account from step 3. You can:
   - add and edit products and options, set stock, hide a product from the shop;
   - open Orders to see your test order and change its status.
4. In Orders you should see the payment status as **unpaid**, and it cannot be changed there.
5. Try to break it: open `/admin` in a private window without signing in (you should be sent to the
   login page), and try a wrong password (you should get a polite message).

## Troubleshooting

- **"The shop is not connected to its database yet"**: `.env.local` is missing, misnamed, or in the
  wrong folder. Fix it, then stop and restart `npm run dev` (it only reads the file on start).
- **"We could not load the shop"**: check the technical detail shown. "permission denied" usually
  means step 2 file 002 was not run.
- **Shop is empty**: you skipped `seed.sql`, or your products are all hidden.
- **Admin says "No admin access"**: the email in step 3.3 did not match the account you signed in with.

## Known limits (please read)

- I could not run the SQL myself. Treat nothing as secure until your Step 4 report says all checks passed.
- Anyone can call `place_order`. It limits basket size and quantities, but it has no spam protection
  (rate limiting or CAPTCHA). Until payments exist, every order is unpaid and must not be shipped.
- If an order is cancelled, stock is **not** put back automatically. Adjust it by hand in the product page.
- Prices and stock on screen are read when the page loads. The database always checks again when the
  order is placed, and tells the shopper if something changed.
- Saving a product with several options makes several database calls. If your internet drops halfway,
  the page tells you and you can open the product to finish.
- Delivery prices live in the `store_settings` table (edit them in the Supabase Table Editor).
- Product pictures are still the drawn placeholders (no image upload), as agreed.

---
---

# Part 2: Editable homepage, pages and photos (migration 004)

This adds: an editable homepage banner (text, button, large picture), editable About, Contact,
Delivery, Returns and Privacy pages, product photos, and choosing which homepage sections show
and in what order. Pictures are stored in Supabase Storage.

**You do NOT re-run `001`, `002` or `003`, and you do not change the database by hand.**
Everything new is in one new file: `supabase/004_storefront_content.sql`.

## What the migration does and does not touch

- It only **adds** new things: four tables (`site_content`, `site_pages`, `home_sections`,
  `product_images`), one image bucket called `storefront`, and the rules for them.
- It does **not** change your products, orders, stock, admin list or any earlier rule.
- It is **safe to run again**. Starter text is only inserted where a row does not exist yet, so
  **anything you have edited is never overwritten**. The one thing a re-run resets is the image
  bucket's safety settings (5 MB, JPEG/PNG/WebP only), on purpose, so they cannot be left loosened.
- If you forgot 001, 002 or 003, it stops straight away with a clear message and changes nothing.

## Step 1. Apply the migration

1. In Supabase open **SQL Editor**, then **New query**.
2. Open `supabase/004_storefront_content.sql` on your computer, copy **everything**, paste it in, click **Run**.
3. You should see "Success. No rows returned". If you see a red error, copy the whole message and send it to me.

## Step 2. Check the new security rules

1. Open `supabase/verify_storefront.sql`, copy everything, paste into a new query, **Run**.
2. A red error box is **expected** (it is how the report is printed and how the script undoes its own
   test data). The report is inside it, and the **result is printed twice: on its first line and on its
   last line**. There are only three possible results:
   - `ALL n CHECKS PASSED`: every check ran and passed.
   - `n OF m CHECKS FAILED. Do not go live.`: something is wrong. Send me the whole report. A `FAIL`
     line also prints "what happened" underneath it.
   - `NOT FULLY VERIFIED — do not go live`: nothing failed, but something was **skipped**, so it was
     not tested. Each `SKIP` line says what and why. This is **not** a pass.

   Section G is about deleting files. Supabase does not allow deleting files by running SQL against
   its storage tables, so G does two things:
   - It reads the delete rule from your database and checks it **exactly**: a delete rule, for signed-in
     users only, whose condition is exactly "the bucket is storefront AND `is_admin()`", that calls the
     real `public.is_admin()` function, with row level security switched on and **no other rule that
     could allow deleting files**. Any difference is a `FAIL` that shows the rule it found. This is
     strict on purpose, so a false alarm is possible: if you get one, send me the report.
   - Only if it can step Supabase's guard aside inside its own undo-able transaction, it also tries real
     deletes of a test row as a shopper, a signed-in non-admin and an admin. If it cannot, it prints
     `SKIP  delete behaviour` and the result is `NOT FULLY VERIFIED — do not go live`, even if every
     other check passed. In that case you must do the website deletion test (below) before going live.
3. If any line says `FAIL`, stop and send me the whole report. A `SKIP` in the Admin section (or on the
   admin delete check) means no admin exists yet: create one, then run the script again.
4. This script only uses made-up test data that is rolled back. It never touches your real content.

## Step 3. Update the website files and run it

1. Replace your project files with the new ones (keep your own `.env.local`; it is not in the zip).
2. No new packages are needed. Run `npm run dev` (run `npm install` if you have not yet).
3. Sign in at `/admin`. You will see two new menu items: **Homepage** and **Pages**, and product
   pages now have a **Photos** section at the bottom.

## Step 4. Try it (use test pictures only)

**Homepage** (admin, Homepage)
- Type a picture description, then choose a JPEG/PNG/WebP under 5 MB. Open the shop in another tab
  and refresh: the picture should appear large beside the headline.
- Replace it with another picture. The old file is deleted from storage automatically.
- Edit the headline, supporting text and button label, then Save banner text.
- Button link tests. These should be **refused with a message**: `//example.com`, `/\example.com`,
  `http://example.com`, `javascript:alert(1)`, `/shop now` (a space). These should be **accepted**:
  `/shop`, `/shop?category=lips`, `https://example.com`.
- Sections: use Up/Down and the Show tick-boxes, then Save sections. Refresh the shop to see the new order.

**Pictures that should be refused** (try each, you should get a clear message)
- a file larger than 5 MB
- a GIF, an SVG, or a PDF
- a text file you renamed to `photo.jpg`

**Pages** (admin, Pages)
- Choose Delivery. The text uses `{{delivery_price}}` and similar words that fill themselves in.
  Change the wording and Save, then check the Delivery page in the shop.
- Type `<script>alert(1)</script>` into any page. It should appear as ordinary visible text and do nothing.
- Choose Contact and change the email, phone, hours and address. The footer updates too.
- Add a picture to About, then remove it.

**Product photos** (admin, Products, Edit a product, Photos section)
- Add two photos with descriptions, reorder them with Up/Down, replace one, remove one.
- On the shop, the product card shows the first photo and the product page shows a gallery. A product
  with no photos still shows the drawn sample picture.

**Not signed in:** open `/admin/homepage` in a private window. You should be sent to the login page.

## Testing photo deletion through the website

Supabase only deletes files properly through its Storage API, which is exactly what the admin pages
use. So the real test is to use the website. **Use a throwaway test photo for all of this.**

**A. Deleting works for an admin**
1. Sign in at `/admin`, open a product, and add a test photo (with a description).
2. Right-click the photo preview, choose "Open image in new tab" (or "Copy image address"). Keep that tab.
   The address looks like `https://YOUR-PROJECT-REF.supabase.co/storage/v1/object/public/storefront/products/.../....jpg`.
3. Back in the admin, click **Remove** on that photo and confirm. You should see "Photo removed."
4. Reload the tab with the picture's address. It should now show an error such as "Object not found".
   That proves the **file itself** was deleted, not just hidden on the page.
5. Optional: in the Supabase dashboard open Storage, then the `storefront` bucket, and check the file is gone.
6. Do the same with **Replace** on a photo (the old address should stop working, the new one should work)
   and with **Remove picture** on the homepage banner.

**B. Deleting is refused for everyone else**
1. Add another test photo and copy its address as above.
2. In a terminal, try to delete it **without signing in**. Put in your own project address, your
   **publishable** key (never a secret key), and the part of the address after `/storefront/`:

   ```
   curl.exe -i -X DELETE "https://YOUR-PROJECT-REF.supabase.co/storage/v1/object/storefront/PATH-OF-THE-PHOTO" -H "apikey: YOUR_PUBLISHABLE_KEY"
   ```
   (On Mac or Linux, use `curl` instead of `curl.exe`. If your project still uses the older long "anon" key
   that starts with `eyJ`, also add `-H "Authorization: Bearer YOUR_ANON_KEY"`.)
3. You should get an error status (such as 400, 401, 403 or 404) and a message. You should **not** get a
   success (200).
4. Reload the photo's address in the browser. **It must still show the picture.**
5. **If the picture disappears, tell me straight away.** It would mean the rule is wrong.
6. Then remove that test photo properly from the admin, as in part A.

## Editing text: the tiny rules

Page text is plain text. There is no HTML. Three conveniences only:
- a line starting with `## ` becomes a heading
- lines starting with `- ` become a bullet list
- a blank line starts a new paragraph
Words in `{{double braces}}` (listed in the admin under "Words that fill themselves in") are replaced
with the current value, such as the delivery price.

## Troubleshooting

- **Homepage/Pages say the tables are not available**: 004 has not been run yet. The shop itself keeps
  working with its built-in starter text until you run it.
- **Upload says "row-level security" or "not allowed"**: you are not signed in as an admin, or 004's
  storage rules were not applied. Re-run 004 and `verify_storefront.sql`.
- **Upload says the type is not supported**: only JPEG, PNG and WebP are accepted.
- **A picture does not appear**: refresh the shop page. Check the picture has a description.

## Known limits (part 2)

- I could not run the SQL or the site. Treat the rules as unverified until your report says all checks passed.
- The browser checks a file's real format (its first bytes). Supabase itself enforces the 5 MB limit and
  the allowed types by the file type the browser declares; it does not inspect file contents. Only
  admins can upload, so the risk is low, but this is the honest limit.
- The bucket is public: anyone who has a picture's exact web address can view it. That includes photos of
  a product you later hide. Do not upload anything private.
- Pictures are not resized or compressed. Large photos make pages slower, so resize them to about
  2000 pixels wide first.
- Saving text and uploading a picture are separate actions. The picture saves the moment you upload it.
- I removed the second hero button ("Browse lips"), since it only suited one kind of shop. There is one
  editable button.
- The built-in starter text in `src/content/defaults.ts` is only a fallback and is not edited by the admin.
