-- Failsafes: payments that land after a cancel, reconciliation, idempotent checkout,
-- race-free stock edits, confirmation-email bookkeeping and a guard on order updates.

alter table public.orders
  add column payment_conflict boolean not null default false,
  add column amount_mismatch boolean not null default false,
  add column confirmation_sent_at timestamptz,
  add column idempotency_key text unique
    check (idempotency_key is null or idempotency_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  add column paymongo_checkout_url text
    check (paymongo_checkout_url is null or char_length(paymongo_checkout_url) <= 2000);

comment on column public.orders.payment_conflict is 'PayMongo reported a payment after the order was cancelled: refund it or fulfil it.';
comment on column public.orders.amount_mismatch is 'The paid amount or currency did not match the order total.';
comment on column public.orders.confirmation_sent_at is 'When the customer confirmation email was sent (claimed before sending, cleared on failure).';

-- Orders paid before this migration already got their email.
update public.orders set confirmation_sent_at = coalesce(paid_at, created_at) where status in ('paid', 'shipped');

create index orders_status_created_at_idx on public.orders (status, created_at);

-- Lock the order's variants, flag oversold (short stock or a variant that no longer exists), take stock.
create function public.apply_order_stock(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_oversold boolean;
begin
  perform 1 from product_variants v
  join order_items oi on oi.variant_id = v.id
  where oi.order_id = p_order_id
  order by v.id
  for update of v;

  select exists (
    select 1 from order_items oi
    left join product_variants v on v.id = oi.variant_id
    where oi.order_id = p_order_id and (v.id is null or v.stock < oi.qty)
  ) into v_oversold;

  if v_oversold then
    update orders set oversold = true where id = p_order_id;
  end if;

  update product_variants v set stock = greatest(v.stock - oi.qty, 0)
  from order_items oi
  where oi.order_id = p_order_id and oi.variant_id = v.id;

  return v_oversold;
end;
$$;
revoke execute on function public.apply_order_stock(uuid) from public, anon, authenticated, service_role;

-- Called by the webhook and by reconciliation. Outcomes:
--   paid               pending -> paid, stock taken
--   already_paid       paid/shipped already (idempotent repeat)
--   paid_after_cancel  money arrived for a cancelled order: flagged, status and stock untouched
--   unknown            no order has this checkout id
create function public.record_checkout_payment(
  p_checkout_id text,
  p_paid_centavos integer default null,
  p_currency text default null
) returns table (order_id uuid, outcome text, oversold boolean, amount_mismatch boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_order orders%rowtype;
  v_mismatch boolean;
  v_oversold boolean;
begin
  if p_checkout_id is null or char_length(p_checkout_id) not between 1 and 200 then
    return query select null::uuid, 'unknown'::text, false, false;
    return;
  end if;

  select * into v_order from orders o where o.paymongo_checkout_id = p_checkout_id for update;
  if not found then
    return query select null::uuid, 'unknown'::text, false, false;
    return;
  end if;

  v_mismatch := coalesce(p_paid_centavos <> v_order.total_centavos, false)
             or coalesce(upper(p_currency) <> 'PHP', false);

  if v_order.status in ('paid', 'shipped') then
    return query select v_order.id, 'already_paid'::text, v_order.oversold, v_order.amount_mismatch;
    return;
  end if;

  if v_order.status = 'cancelled' then
    update orders o
    set payment_conflict = true, paid_at = coalesce(o.paid_at, now()), amount_mismatch = o.amount_mismatch or v_mismatch
    where o.id = v_order.id;
    return query select v_order.id, 'paid_after_cancel'::text, v_order.oversold, v_order.amount_mismatch or v_mismatch;
    return;
  end if;

  perform set_config('app.order_payment', 'on', true);
  update orders o set status = 'paid', paid_at = now(), amount_mismatch = v_mismatch where o.id = v_order.id;
  perform set_config('app.order_payment', '', true);
  v_oversold := public.apply_order_stock(v_order.id);
  return query select v_order.id, 'paid'::text, v_oversold, v_mismatch;
end;
$$;
revoke execute on function public.record_checkout_payment(text, integer, text) from public, anon, authenticated;
grant execute on function public.record_checkout_payment(text, integer, text) to service_role;

-- Kept for compatibility with code deployed before this migration: same contract, new engine.
create or replace function public.mark_order_paid(p_checkout_id text) returns uuid
language sql security definer set search_path = public as $$
  select r.order_id from public.record_checkout_payment(p_checkout_id) r where r.outcome = 'paid';
$$;

-- Owner chose to fulfil a payment that arrived after a cancel.
create function public.accept_conflicted_payment(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can accept a conflicted payment' using errcode = '42501';
  end if;
  perform set_config('app.order_payment', 'on', true);
  update orders set status = 'paid'
  where id = p_order_id and status = 'cancelled' and payment_conflict
  returning id into v_id;
  perform set_config('app.order_payment', '', true);
  if v_id is null then
    return false;
  end if;
  perform public.apply_order_stock(v_id);
  return true;
end;
$$;
revoke execute on function public.accept_conflicted_payment(uuid) from public, anon;
grant execute on function public.accept_conflicted_payment(uuid) to authenticated;

-- Admin stock save. p_stock: [{"size":"M","stock":7,"orig":5}, ...]; orig is the value the form loaded.
-- Existing sizes move by (stock - orig) so sales made while the form was open aren't overwritten.
-- Sizes left out are removed, unless an open order still points at them (then they drop to 0).
create function public.save_product_stock(p_product_id uuid, p_stock jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_sizes product_size[];
begin
  if not public.is_admin() then
    raise exception 'only admins can change stock' using errcode = '42501';
  end if;
  if jsonb_typeof(p_stock) is distinct from 'array' then
    raise exception 'p_stock must be a JSON array' using errcode = '22023';
  end if;

  perform 1 from product_variants where product_id = p_product_id order by id for update;

  for r in
    select (e->>'size')::product_size as size, (e->>'stock')::integer as stock, (e->>'orig')::integer as orig
    from jsonb_array_elements(p_stock) e
  loop
    if r.stock is null or r.stock < 0 then
      raise exception 'stock for % must be 0 or more', r.size using errcode = '22023';
    end if;
    v_sizes := array_append(v_sizes, r.size);
    if exists (select 1 from product_variants where product_id = p_product_id and size = r.size) then
      if r.orig is null then
        update product_variants set stock = r.stock where product_id = p_product_id and size = r.size;
      elsif r.stock <> r.orig then
        update product_variants set stock = greatest(stock + (r.stock - r.orig), 0)
        where product_id = p_product_id and size = r.size;
      end if;
    else
      insert into product_variants (product_id, size, stock) values (p_product_id, r.size, r.stock);
    end if;
  end loop;

  update product_variants v set stock = 0
  where v.product_id = p_product_id
    and not (v.size = any (coalesce(v_sizes, '{}')))
    and exists (
      select 1 from order_items oi join orders o on o.id = oi.order_id
      where oi.variant_id = v.id and (o.status in ('pending', 'paid') or o.payment_conflict)
    );
  delete from product_variants v
  where v.product_id = p_product_id
    and not (v.size = any (coalesce(v_sizes, '{}')))
    and not exists (
      select 1 from order_items oi join orders o on o.id = oi.order_id
      where oi.variant_id = v.id and (o.status in ('pending', 'paid') or o.payment_conflict)
    );
end;
$$;
revoke execute on function public.save_product_stock(uuid, jsonb) from public, anon;
grant execute on function public.save_product_stock(uuid, jsonb) to authenticated;

-- Order + items in one transaction (server code, service role only).
create function public.create_pending_order(p_order jsonb) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_order->'items') is distinct from 'array' or jsonb_array_length(p_order->'items') = 0 then
    raise exception 'an order needs at least one item' using errcode = '22023';
  end if;

  insert into orders (customer_name, email, phone, address, subtotal_centavos, shipping_centavos, total_centavos, idempotency_key)
  values (
    p_order->>'customer_name', p_order->>'email', p_order->>'phone', coalesce(p_order->'address', '{}'::jsonb),
    (p_order->>'subtotal_centavos')::integer, (p_order->>'shipping_centavos')::integer, (p_order->>'total_centavos')::integer,
    nullif(p_order->>'idempotency_key', '')
  )
  returning id into v_id;

  insert into order_items (order_id, variant_id, product_name, size, qty, price_centavos)
  select v_id, (i->>'variant_id')::uuid, i->>'product_name', (i->>'size')::product_size, (i->>'qty')::integer, (i->>'price_centavos')::integer
  from jsonb_array_elements(p_order->'items') i;

  return v_id;
end;
$$;
revoke execute on function public.create_pending_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order(jsonb) to service_role;

-- Guard: amounts never change after checkout, the checkout id and idempotency key are write-once,
-- and status only moves pending -> cancelled, paid -> shipped, or -> paid inside the payment functions.
create function public.guard_order_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.subtotal_centavos is distinct from old.subtotal_centavos
     or new.shipping_centavos is distinct from old.shipping_centavos
     or new.total_centavos is distinct from old.total_centavos
     or new.created_at is distinct from old.created_at then
    raise exception 'order amounts cannot change after checkout' using errcode = '23514';
  end if;
  if old.paymongo_checkout_id is not null and new.paymongo_checkout_id is distinct from old.paymongo_checkout_id then
    raise exception 'the PayMongo checkout id cannot change once attached' using errcode = '23514';
  end if;
  if old.idempotency_key is not null and new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'the idempotency key cannot change' using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    if (old.status = 'pending' and new.status = 'cancelled') or (old.status = 'paid' and new.status = 'shipped') then
      null;
    elsif new.status = 'paid' and old.status in ('pending', 'cancelled')
          and current_setting('app.order_payment', true) = 'on' then
      null;
    else
      raise exception 'order status cannot change from % to %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_guard_update before update on public.orders
  for each row execute function public.guard_order_update();
