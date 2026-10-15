begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into products (id, slug, name, category, price_centavos)
values ('00000000-0000-0000-0000-0000000000b1', 'mop-cap', 'Test Cap', 'tops', 50000);
insert into product_variants (id, product_id, size, stock)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'M', 2);

insert into orders (id, customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos, paymongo_checkout_id) values
  ('00000000-0000-0000-0000-0000000000e1', 'A', 'a@example.com', '+639170000001', '{}', 100000, 15000, 115000, 'cs_test_1'),
  ('00000000-0000-0000-0000-0000000000e2', 'B', 'b@example.com', '+639170000002', '{}', 50000, 15000, 65000, 'cs_test_2');
insert into order_items (order_id, variant_id, product_name, size, qty, price_centavos) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Test Cap', 'M', 2, 50000),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', 'Test Cap', 'M', 1, 50000);

select is(mark_order_paid('cs_test_1'), '00000000-0000-0000-0000-0000000000e1'::uuid, 'returns the order id when it marks it paid');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'stock lowered by qty');
select is(mark_order_paid('cs_test_1'), null::uuid, 'a repeated webhook is a no-op');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'stock not lowered twice');
select is(mark_order_paid('cs_test_2'), '00000000-0000-0000-0000-0000000000e2'::uuid, 'an oversold order is still marked paid');
select is((select stock from product_variants where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'stock never goes negative');
select ok((select oversold from orders where id = '00000000-0000-0000-0000-0000000000e2'), 'the oversold order is flagged');
select is(mark_order_paid('cs_unknown'), null::uuid, 'an unknown checkout id returns null');

select * from finish();
rollback;
