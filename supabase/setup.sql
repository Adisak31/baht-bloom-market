create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(12, 2) not null check (price >= 0),
  description text not null default '',
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

alter table public.products enable row level security;

drop policy if exists "Public can view products" on public.products;
create policy "Public can view products"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "Signed-in users can manage products" on public.products;
create policy "Signed-in users can manage products"
  on public.products for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Signed-in users can upload product images" on storage.objects;
create policy "Signed-in users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and auth.uid() is not null);

drop policy if exists "Signed-in users can update product images" on storage.objects;
create policy "Signed-in users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and auth.uid() is not null)
  with check (bucket_id = 'product-images' and auth.uid() is not null);

drop policy if exists "Signed-in users can delete product images" on storage.objects;
create policy "Signed-in users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and auth.uid() is not null);