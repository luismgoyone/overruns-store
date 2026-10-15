create type public.product_category as enum ('tops', 'bottoms', 'outerwear', 'kids', 'accessories');
create type public.product_size as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS');
create type public.order_status as enum ('pending', 'paid', 'shipped', 'cancelled');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  category public.product_category not null,
  price_centavos integer not null check (price_centavos > 0),
  retail_price_centavos integer check (retail_price_centavos is null or retail_price_centavos > price_centavos),
  images text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size public.product_size not null,
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, size)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email text not null,
  phone text not null,
  address jsonb not null,
  subtotal_centavos integer not null check (subtotal_centavos >= 0),
  shipping_centavos integer not null check (shipping_centavos >= 0),
  total_centavos integer not null check (total_centavos = subtotal_centavos + shipping_centavos),
  status public.order_status not null default 'pending',
  paymongo_checkout_id text unique,
  oversold boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_created_at_idx on public.orders (created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  size public.product_size not null,
  qty integer not null check (qty > 0),
  price_centavos integer not null check (price_centavos >= 0),
  unique (order_id, variant_id)
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admins enable row level security; -- no policies: service role only

create policy "anyone reads active products" on public.products
  for select using (is_active or public.is_admin());
create policy "admin writes products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "anyone reads variants of visible products" on public.product_variants
  for select using (exists (
    select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())
  ));
create policy "admin writes variants" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders are created by server code with the service role (which bypasses RLS).
create policy "admin reads orders" on public.orders
  for select to authenticated using (public.is_admin());
create policy "admin updates orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin reads order items" on public.order_items
  for select to authenticated using (public.is_admin());

-- Called by the PayMongo webhook. Idempotent: only a pending order transitions.
create function public.mark_order_paid(p_checkout_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
begin
  update orders set status = 'paid', paid_at = now()
  where paymongo_checkout_id = p_checkout_id and status = 'pending'
  returning id into v_order_id;

  if v_order_id is null then
    return null;
  end if;

  -- Lock the variant rows so concurrent webhooks serialize on stock.
  perform 1 from product_variants v
  join order_items oi on oi.variant_id = v.id
  where oi.order_id = v_order_id
  for update of v;

  update orders set oversold = true
  where id = v_order_id and exists (
    select 1 from order_items oi join product_variants v on v.id = oi.variant_id
    where oi.order_id = v_order_id and v.stock < oi.qty
  );

  update product_variants v set stock = greatest(v.stock - oi.qty, 0)
  from order_items oi
  where oi.order_id = v_order_id and oi.variant_id = v.id;

  return v_order_id;
end;
$$;

revoke execute on function public.mark_order_paid(text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text) to service_role;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "admin uploads product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin updates product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "admin deletes product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
