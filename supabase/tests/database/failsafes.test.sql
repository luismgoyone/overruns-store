begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- Fixtures -------------------------------------------------------------------
insert into products (id, slug, name, category, price_centavos) values
  ('00000000-0000-0000-0000-0000000001b1', 'fs-tee', 'FS Tee', 'tops', 50000);
insert into product_variants (id, product_id, size, stock) values
  ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001b1', 'M', 5),
  ('00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-0000000001b1', 'L', 4),
  ('00000000-0000-0000-0000-0000000001d3', '00000000-0000-0000-0000-0000000001b1', 'XL', 3),
  ('00000000-0000-0000-0000-0000000001d4', '00000000-0000-0000-0000-0000000001b1', 'S', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'fs-owner@example.com'),
  ('00000000-0000-0000-0000-0000000001a2', 'fs-shopper@example.com');
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000001a1');

insert into orders (id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos, paymongo_checkout_id) values
  ('00000000-0000-0000-0000-0000000001e1', 'Cancelled', 'c@example.com', '+639170000001', '{}', 50000, 15000, 65000, 'cs_fs_cancelled'),
  ('00000000-0000-0000-0000-0000000001e2', 'Mismatch', 'm@example.com', '+639170000002', '{}', 50000, 15000, 65000, 'cs_fs_mismatch'),
  ('00000000-0000-0000-0000-0000000001e3', 'Orphan', 'o@example.com', '+639170000003', '{}', 50000, 15000, 65000, 'cs_fs_orphan'),
  ('00000000-0000-0000-0000-0000000001e4', 'Stock', 's@example.com', '+639170000004', '{}', 100000, 15000, 115000, 'cs_fs_stock'),
  ('00000000-0000-0000-0000-0000000001e5', 'Holds L', 'l@example.com', '+639170000005', '{}', 50000, 15000, 65000, null);
insert into order_items (order_id, variant_id, product_name, size, qty, price_centavos) values
  ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-0000000001d1', 'FS Tee', 'M', 1, 50000),
  ('00000000-0000-0000-0000-0000000001e2', '00000000-0000-0000-0000-0000000001d1', 'FS Tee', 'M', 1, 50000),
  ('00000000-0000-0000-0000-0000000001e3', null, 'FS Tee', 'XXL', 1, 50000),
  ('00000000-0000-0000-0000-0000000001e4', '00000000-0000-0000-0000-0000000001d1', 'FS Tee', 'M', 2, 50000),
  ('00000000-0000-0000-0000-0000000001e5', '00000000-0000-0000-0000-0000000001d2', 'FS Tee', 'L', 1, 50000);

-- 1. Paid after cancel ---------------------------------------------------------
update orders set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000001e1';
select is(
  (select outcome from record_checkout_payment('cs_fs_cancelled')),
  'paid_after_cancel', 'a payment for a cancelled order is reported as paid_after_cancel');
select is((select status::text from orders where id = '00000000-0000-0000-0000-0000000001e1'), 'cancelled', 'the order stays cancelled');
select ok((select payment_conflict from orders where id = '00000000-0000-0000-0000-0000000001e1'), 'the order is flagged payment_conflict');
select isnt((select paid_at from orders where id = '00000000-0000-0000-0000-0000000001e1'), null, 'paid_at records when the money arrived');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d1'), 5, 'stock is not touched for a cancelled order');
select is(mark_order_paid('cs_fs_cancelled'), null::uuid, 'the legacy mark_order_paid still returns null for it');

-- 2. Outcomes for other cases -------------------------------------------------------
select is((select outcome from record_checkout_payment('cs_fs_nope')), 'unknown', 'an unknown checkout id is reported as unknown');
select is((select outcome from record_checkout_payment(repeat('x', 201))), 'unknown', 'an over-long checkout id is rejected as unknown');
select is((select outcome from record_checkout_payment('')), 'unknown', 'an empty checkout id is rejected as unknown');

-- 3. Amount / currency mismatch: still paid, but flagged ------------------------------
select is((select outcome from record_checkout_payment('cs_fs_mismatch', 100, 'PHP')), 'paid', 'a short payment still marks the order paid');
select ok((select amount_mismatch from orders where id = '00000000-0000-0000-0000-0000000001e2'), 'and flags amount_mismatch');
select is((select outcome from record_checkout_payment('cs_fs_mismatch', 65000, 'PHP')), 'already_paid', 'a repeat is already_paid');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d1'), 4, 'stock taken once');

-- 4. Orphaned order item (variant deleted) => oversold ---------------------------------
select is((select outcome from record_checkout_payment('cs_fs_orphan', 65000, 'PHP')), 'paid', 'an order whose variant vanished is marked paid');
select ok((select oversold from orders where id = '00000000-0000-0000-0000-0000000001e3'), 'and flagged oversold');
select ok(not (select amount_mismatch from orders where id = '00000000-0000-0000-0000-0000000001e3'), 'a matching amount is not flagged');

-- 5. Status / money guard ------------------------------------------------------------
select throws_ok(
  $$update orders set total_centavos = 1, subtotal_centavos = 1, shipping_centavos = 0 where id = '00000000-0000-0000-0000-0000000001e4'$$,
  '23514', null, 'order amounts are immutable');
select throws_ok(
  $$update orders set status = 'paid' where id = '00000000-0000-0000-0000-0000000001e4'$$,
  '23514', null, 'pending -> paid only through the payment function');
select throws_ok(
  $$update orders set status = 'pending' where id = '00000000-0000-0000-0000-0000000001e2'$$,
  '23514', null, 'paid -> pending is blocked');
select throws_ok(
  $$update orders set status = 'pending' where id = '00000000-0000-0000-0000-0000000001e1'$$,
  '23514', null, 'cancelled -> pending is blocked');
select throws_ok(
  $$update orders set paymongo_checkout_id = 'cs_other' where id = '00000000-0000-0000-0000-0000000001e4'$$,
  '23514', null, 'a checkout id cannot be swapped once attached');
select lives_ok(
  $$update orders set status = 'shipped' where id = '00000000-0000-0000-0000-0000000001e2'$$,
  'paid -> shipped is allowed');
select lives_ok(
  $$update orders set confirmation_sent_at = now() where id = '00000000-0000-0000-0000-0000000001e2'$$,
  'bookkeeping columns can change');

-- 6. Stock deltas (admin save) ---------------------------------------------------------
select is((select outcome from record_checkout_payment('cs_fs_stock')), 'paid', 'a paid order of 2 takes stock');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d1'), 2, 'M stock is now 2 (5 - 1 - 2)');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a2","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::int from orders), 0, 'a signed-in non-admin sees no orders');
update products set price_centavos = 1 where id = '00000000-0000-0000-0000-0000000001b1';
select throws_ok(
  $$select save_product_stock('00000000-0000-0000-0000-0000000001b1', '[{"size":"M","stock":99,"orig":2}]')$$,
  '42501', null, 'a non-admin cannot change stock');
reset role;
select is((select price_centavos from products where id = '00000000-0000-0000-0000-0000000001b1'), 50000, 'a signed-in non-admin cannot edit products');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
set local role authenticated;
-- The owner loaded the form when M was 5; a sale since then left 2. Saving unchanged keeps 2.
select lives_ok(
  $$select save_product_stock('00000000-0000-0000-0000-0000000001b1', '[{"size":"M","stock":5,"orig":5},{"size":"L","stock":4,"orig":4},{"size":"XL","stock":3,"orig":3},{"size":"S","stock":2,"orig":2}]')$$,
  'admin saves an unchanged form');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d1'), 2, 'unchanged size keeps the concurrent sale (no lost update)');
select lives_ok(
  $$select save_product_stock('00000000-0000-0000-0000-0000000001b1', '[{"size":"M","stock":7,"orig":5},{"size":"L","stock":4,"orig":4},{"size":"XL","stock":3,"orig":3},{"size":"S","stock":2,"orig":2}]')$$,
  'admin adds 2 to M');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d1'), 4, 'the +2 delta applies on top of the live stock');
select lives_ok(
  $$select save_product_stock('00000000-0000-0000-0000-0000000001b1', '[{"size":"M","stock":0,"orig":10},{"size":"OS","stock":6}]')$$,
  'admin removes L, XL and S, adds OS, and lowers M past zero');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d1'), 0, 'stock never goes below zero');
select is((select stock from product_variants where product_id = '00000000-0000-0000-0000-0000000001b1' and size = 'OS'), 6, 'a new size is inserted');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000001d2'), 0, 'a removed size held by a pending order is kept at 0 stock');
select is((select count(*)::int from product_variants where id = '00000000-0000-0000-0000-0000000001d3'), 0, 'a removed size with no open orders is deleted');
reset role;
select is((select variant_id from order_items where order_id = '00000000-0000-0000-0000-0000000001e5'), '00000000-0000-0000-0000-0000000001d2'::uuid, 'the pending order still points at its variant');

-- 7. Atomic order creation ---------------------------------------------------------------
select isnt(
  create_pending_order('{"customer_name":"Atomic","email":"atomic@example.com","phone":"+639170000009","address":{},"subtotal_centavos":50000,"shipping_centavos":15000,"total_centavos":65000,"idempotency_key":"8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c","items":[{"variant_id":"00000000-0000-0000-0000-0000000001d1","product_name":"FS Tee","size":"M","qty":1,"price_centavos":50000}]}'),
  null::uuid, 'create_pending_order returns the new id');
select is((select count(*)::int from order_items oi join orders o on o.id = oi.order_id where o.email = 'atomic@example.com'), 1, 'with its items');
select throws_ok(
  $$select create_pending_order('{"customer_name":"Broken","email":"broken@example.com","phone":"+639170000010","address":{},"subtotal_centavos":50000,"shipping_centavos":15000,"total_centavos":65000,"items":[{"variant_id":"00000000-0000-0000-0000-0000000001d1","product_name":"FS Tee","size":"M","qty":0,"price_centavos":50000}]}')$$,
  '23514', null, 'a bad item fails the call');
select is((select count(*)::int from orders where email = 'broken@example.com'), 0, 'and rolls back the order row');

select throws_ok(
  $$select create_pending_order('{"customer_name":"Twice","email":"twice@example.com","phone":"+639170000011","address":{},"subtotal_centavos":50000,"shipping_centavos":15000,"total_centavos":65000,"idempotency_key":"8a1b7f1e-4d5c-4e2a-9b3c-0d1e2f3a4b5c","items":[{"variant_id":"00000000-0000-0000-0000-0000000001d1","product_name":"FS Tee","size":"M","qty":1,"price_centavos":50000}]}')$$,
  '23505', null, 'the same idempotency key cannot create a second order');

-- 8. Fulfilling a paid-after-cancel order ------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a2","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select accept_conflicted_payment('00000000-0000-0000-0000-0000000001e1')$$,
  '42501', null, 'only an admin can accept a conflicted payment');
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}';
set local role authenticated;
select ok(accept_conflicted_payment('00000000-0000-0000-0000-0000000001e1'), 'the owner chooses to fulfil it');
reset role;
select is((select status::text from orders where id = '00000000-0000-0000-0000-0000000001e1'), 'paid', 'the order becomes paid');
select ok((select oversold from orders where id = '00000000-0000-0000-0000-0000000001e1'), 'and is flagged oversold when the stock has gone');

set local role anon;
select is((select count(*)::int from order_items), 0, 'anon reads no order items');
reset role;

select * from finish();
rollback;
