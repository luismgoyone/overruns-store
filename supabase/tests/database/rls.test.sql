begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into products (id, slug, name, category, price_centavos, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'rls-active-tee', 'Active Tee', 'tops', 50000, true),
  ('00000000-0000-0000-0000-0000000000a2', 'rls-hidden-tee', 'Hidden Tee', 'tops', 50000, false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000ad01', 'owner@example.com');
insert into admins (user_id) values ('00000000-0000-0000-0000-00000000ad01');
insert into orders (id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos)
values ('00000000-0000-0000-0000-0000000000c1', 'Juan', 'juan@example.com', '+639171234567', '{}', 50000, 15000, 65000);

set local role anon;
select is((select count(*)::int from products where slug like 'rls-%'), 1, 'anon sees only active products');
select is((select count(*)::int from orders), 0, 'anon cannot read orders');
select throws_ok(
  $$insert into orders (customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos)
    values ('x', 'x@example.com', '0', '{}', 0, 0, 0)$$,
  '42501', null, 'anon cannot create orders');
select throws_ok($$select public.mark_order_paid('cs_x')$$, '42501', null, 'anon cannot call mark_order_paid');
-- Under RLS an UPDATE on rows you may not write affects 0 rows rather than raising.
-- (A data-modifying CTE can't sit inside a subquery, so run the UPDATE, then check the row.)
update products set price_centavos = 1 where slug = 'rls-active-tee';
reset role;
select is((select price_centavos from products where slug = 'rls-active-tee'), 50000, 'anon cannot edit products');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::int from products where slug like 'rls-%'), 2, 'admin sees inactive products');
select is((select count(*)::int from orders where id = '00000000-0000-0000-0000-0000000000c1'), 1, 'admin reads orders');

select * from finish();
rollback;
