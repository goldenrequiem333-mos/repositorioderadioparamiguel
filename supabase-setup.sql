create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  genre text not null default 'Variado' check (char_length(genre) between 1 and 40),
  city text check (city is null or char_length(trim(city)) between 1 and 60),
  stream_url text not null,
  image_url text not null,
  logo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.stations
  add column if not exists genre text not null default 'Variado'
  check (char_length(genre) between 1 and 40);

alter table public.stations
  add column if not exists city text
  check (city is null or char_length(trim(city)) between 1 and 60);

alter table public.stations
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

create index if not exists stations_owner_created_idx
  on public.stations (owner_id, created_at desc);

create table if not exists public.radio_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.stations enable row level security;
alter table public.radio_admins enable row level security;

create or replace function public.is_radio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.radio_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_radio_admin() from public;
grant execute on function public.is_radio_admin() to authenticated;

drop function if exists public.create_radio_station(uuid, text, text, text, text, text);

create or replace function public.create_radio_station(
  p_id uuid,
  p_name text,
  p_genre text,
  p_city text,
  p_stream_url text,
  p_image_url text
)
returns public.stations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_is_admin boolean;
  v_station_count bigint;
  v_station public.stations;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if char_length(trim(p_name)) not between 1 and 60
     or char_length(trim(p_genre)) not between 1 and 40
     or p_city is null
     or char_length(trim(p_city)) not between 1 and 60
     or p_stream_url !~* '^https?://'
     or p_image_url !~* '^https?://' then
    raise exception using errcode = '22023', message = 'invalid_station_data';
  end if;

  v_is_admin := public.is_radio_admin();
  if not v_is_admin then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
    select count(*) into v_station_count
      from public.stations
      where owner_id = v_user_id;

    if v_station_count >= 5 then
      raise exception using errcode = 'P0001', message = 'station_limit_reached';
    end if;
  end if;

  insert into public.stations (id, name, genre, city, stream_url, image_url, logo_url, owner_id)
  values (
    p_id,
    trim(p_name),
    trim(p_genre),
    trim(p_city),
    trim(p_stream_url),
    trim(p_image_url),
    trim(p_image_url),
    case when v_is_admin then null else v_user_id end
  )
  returning * into v_station;

  return v_station;
end;
$$;

revoke all on function public.create_radio_station(uuid, text, text, text, text, text) from public;
grant execute on function public.create_radio_station(uuid, text, text, text, text, text) to authenticated;

grant select on public.stations to anon, authenticated;
grant insert, delete on public.stations to authenticated;

drop policy if exists "Anyone can read stations" on public.stations;
create policy "Anyone can read stations"
  on public.stations for select
  to anon, authenticated
  using (true);

drop policy if exists "Radio admins can insert stations" on public.stations;
create policy "Radio admins can insert stations"
  on public.stations for insert
  to authenticated
  with check ((select public.is_radio_admin()));

drop policy if exists "Radio admins can delete stations" on public.stations;
create policy "Radio admins can delete stations"
  on public.stations for delete
  to authenticated
  using ((select public.is_radio_admin()));

drop policy if exists "Owners can delete their stations" on public.stations;
create policy "Owners can delete their stations"
  on public.stations for delete
  to authenticated
  using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'radio-images',
  'radio-images',
  true,
  10485760,
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read radio images" on storage.objects;
create policy "Anyone can read radio images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'radio-images');

drop policy if exists "Radio admins can upload their images" on storage.objects;
drop policy if exists "Users can upload their own radio images" on storage.objects;
create policy "Users can upload their own radio images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'radio-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Radio admins can delete their images" on storage.objects;
create policy "Radio admins can delete their images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'radio-images'
    and (select public.is_radio_admin())
  );

drop policy if exists "Owners can delete their radio images" on storage.objects;
create policy "Owners can delete their radio images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'radio-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
