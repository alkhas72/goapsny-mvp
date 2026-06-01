create extension if not exists pgcrypto;
create extension if not exists postgis;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_id bigint unique,
  username text,
  display_name text,
  role text not null default 'tester'
    check (role in ('owner', 'admin', 'operator', 'tester', 'public_user', 'banned')),
  trust_level smallint not null default 1 check (trust_level between 0 and 3),
  ai_enabled boolean not null default true,
  karma integer not null default 0 check (karma >= 0),
  karma_status text not null default 'pedestrian',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  slug text primary key,
  name_ru text not null,
  wheelmap_group text not null,
  osm_tags jsonb not null default '{}'::jsonb,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.accessibility_statuses (
  slug text primary key check (slug in ('green', 'yellow', 'red', 'gray')),
  name_ru text not null,
  description_ru text not null,
  wheelchair_tag text,
  operator_selectable boolean not null default true,
  sort_order integer not null default 0
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null references public.categories(slug),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location geography(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  status text not null default 'gray' references public.accessibility_statuses(slug),
  steps_count smallint check (steps_count is null or steps_count >= 0),
  step_height_cm smallint check (step_height_cm is null or step_height_cm >= 0),
  ramp_type text not null default 'none'
    check (ramp_type in ('none', 'permanent', 'portable_on_request', 'portable_available')),
  door_width_cm smallint check (door_width_cm is null or door_width_cm >= 0),
  entrance_notes text,
  toilet_exists text not null default 'unknown'
    check (toilet_exists in ('yes', 'no', 'unknown')),
  toilet_accessible text not null default 'unknown'
    check (toilet_accessible in ('yes', 'no', 'partial', 'unknown')),
  parking text not null default 'unknown'
    check (parking in ('yes', 'no', 'unknown')),
  comment text,
  osm_tags jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'published'
    check (moderation_status in ('published', 'pending', 'hidden')),
  source text not null default 'operator'
    check (source in ('operator', 'public', 'import', 'ai_seed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  storage_path text not null unique,
  kind text not null default 'facade'
    check (kind in ('facade', 'steps', 'ramp', 'toilet', 'interior')),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint photos_storage_path_shape_check
    check (storage_path ~ '^[0-9a-f-]{36}/(facade|steps|ramp|toilet|interior)\.jpg$')
);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete set null,
  user_id uuid references public.profiles(id),
  photo_path text,
  model text,
  cost_usd numeric(8,4) not null default 0 check (cost_usd >= 0),
  status text not null default 'ok' check (status in ('ok', 'blocked_budget', 'error')),
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now()
);

create table public.karma_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  photo_id uuid references public.photos(id) on delete set null,
  event_type text not null
    check (event_type in ('place_created', 'photo_added', 'full_card_bonus')),
  points integer not null check (points > 0),
  created_at timestamptz not null default now()
);

create or replace function public.karma_status_for(total_karma integer)
returns text
language sql
immutable
as $$
  select case
    when total_karma >= 1800 then 'legend'
    when total_karma >= 1000 then 'accessibility_keeper'
    when total_karma >= 500 then 'city_expert'
    when total_karma >= 250 then 'guide'
    when total_karma >= 100 then 'cartographer'
    when total_karma >= 30 then 'explorer'
    else 'pedestrian'
  end;
$$;

create or replace function public.add_karma(
  target_user_id uuid,
  target_place_id uuid,
  target_photo_id uuid,
  target_event_type text,
  target_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.karma_events (user_id, place_id, photo_id, event_type, points)
  values (target_user_id, target_place_id, target_photo_id, target_event_type, target_points)
  on conflict do nothing;

  update public.profiles
  set
    karma = totals.total_karma,
    karma_status = public.karma_status_for(totals.total_karma),
    updated_at = now()
  from (
    select coalesce(sum(points), 0)::integer as total_karma
    from public.karma_events
    where user_id = target_user_id
  ) as totals
  where profiles.id = target_user_id;
end;
$$;

create or replace function public.place_has_full_card(place_row public.places)
returns boolean
language sql
immutable
as $$
  select
    place_row.name is not null
    and length(btrim(place_row.name)) > 0
    and place_row.category is not null
    and place_row.status in ('green', 'yellow', 'red')
    and (
      place_row.steps_count is not null
      or place_row.ramp_type <> 'none'
      or place_row.entrance_notes is not null
      or place_row.toilet_exists <> 'unknown'
      or place_row.parking <> 'unknown'
    );
$$;

create or replace function public.award_place_karma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_karma(new.created_by, new.id, null, 'place_created', 10);
  if public.place_has_full_card(new) then
    perform public.add_karma(new.created_by, new.id, null, 'full_card_bonus', 10);
  end if;
  return new;
end;
$$;

create or replace function public.award_photo_karma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_karma(new.uploaded_by, new.place_id, new.id, 'photo_added', 5);
  return new;
end;
$$;

create or replace function public.build_place_osm_tags(place_row public.places)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  category_tags jsonb := '{}'::jsonb;
  tags jsonb := '{}'::jsonb;
begin
  select c.osm_tags into category_tags from public.categories c where c.slug = place_row.category;
  tags := coalesce(category_tags, '{}'::jsonb);

  if place_row.status = 'green' then
    tags := tags || jsonb_build_object('wheelchair', 'yes');
  elsif place_row.status = 'yellow' then
    tags := tags || jsonb_build_object('wheelchair', 'limited');
  elsif place_row.status = 'red' then
    tags := tags || jsonb_build_object('wheelchair', 'no');
  elsif place_row.status = 'gray' then
    tags := tags || jsonb_build_object('wheelchair', 'unknown');
  end if;

  if coalesce(place_row.entrance_notes, place_row.comment) is not null then
    tags := tags || jsonb_build_object('wheelchair:description', coalesce(place_row.entrance_notes, place_row.comment));
  end if;
  if place_row.steps_count is not null then
    tags := tags || jsonb_build_object('step_count', place_row.steps_count::text);
    if place_row.steps_count = 0 then
      tags := tags || jsonb_build_object('entrance', 'yes');
    end if;
  end if;
  if place_row.ramp_type = 'permanent' then
    tags := tags || jsonb_build_object('ramp', 'yes', 'ramp:wheelchair', 'yes');
  elsif place_row.ramp_type in ('portable_on_request', 'portable_available') then
    tags := tags || jsonb_build_object('ramp:portable', 'yes');
  end if;
  if place_row.door_width_cm is not null then
    tags := tags || jsonb_build_object('door:width', trim(to_char(place_row.door_width_cm::numeric / 100, 'FM999999990.00')));
  end if;
  if place_row.toilet_exists = 'yes' then
    tags := tags || jsonb_build_object('toilets', 'yes');
  end if;
  if place_row.toilet_accessible = 'yes' then
    tags := tags || jsonb_build_object('toilets:wheelchair', 'yes');
  elsif place_row.toilet_accessible = 'partial' then
    tags := tags || jsonb_build_object('toilets:wheelchair', 'limited');
  elsif place_row.toilet_accessible = 'no' then
    tags := tags || jsonb_build_object('toilets:wheelchair', 'no');
  end if;

  return tags;
end;
$$;

create or replace function public.set_place_osm_tags()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.osm_tags = public.build_place_osm_tags(new);
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger places_set_updated_at before update on public.places
  for each row execute function public.set_updated_at();
create trigger places_set_osm_tags before insert or update on public.places
  for each row execute function public.set_place_osm_tags();
create trigger places_award_karma after insert on public.places
  for each row execute function public.award_place_karma();
create trigger photos_award_karma after insert on public.photos
  for each row execute function public.award_photo_karma();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = (select auth.uid())), 'public_user');
$$;

create or replace function public.current_user_can_collect()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin', 'operator', 'tester');
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin');
$$;

create index profiles_telegram_id_idx on public.profiles (telegram_id);
create index profiles_role_idx on public.profiles (role);
create index places_status_idx on public.places (status);
create index places_geo_idx on public.places (lat, lng);
create index places_location_gix on public.places using gist (location);
create index places_category_idx on public.places (category);
create index places_created_by_idx on public.places (created_by);
create index places_published_created_idx on public.places (created_at desc)
  where moderation_status = 'published';
create index photos_place_idx on public.photos (place_id);
create index photos_uploaded_by_idx on public.photos (uploaded_by);
create index ai_jobs_created_idx on public.ai_jobs (created_at);
create index ai_jobs_user_created_idx on public.ai_jobs (user_id, created_at desc);
create index karma_events_user_idx on public.karma_events (user_id, created_at desc);
create unique index karma_events_place_once_idx on public.karma_events (place_id, event_type)
  where event_type in ('place_created', 'full_card_bonus');
create unique index karma_events_photo_once_idx on public.karma_events (photo_id, event_type)
  where event_type = 'photo_added';

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accessibility_statuses enable row level security;
alter table public.places enable row level security;
alter table public.photos enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.karma_events enable row level security;

create policy profiles_read_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_is_admin()));

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy categories_read_active on public.categories
  for select to authenticated
  using (is_active = true or (select public.current_user_is_admin()));
create policy categories_admin_write on public.categories
  for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy accessibility_statuses_read on public.accessibility_statuses
  for select to authenticated
  using (true);

create policy places_read_published on public.places
  for select to authenticated
  using (moderation_status = 'published' or created_by = (select auth.uid()) or (select public.current_user_is_admin()));
create policy places_insert_collectors on public.places
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select public.current_user_can_collect())
    and moderation_status = 'published'
    and status in ('green', 'yellow', 'red')
  );
create policy places_update_admin_or_author on public.places
  for update to authenticated
  using ((select public.current_user_is_admin()) or created_by = (select auth.uid()))
  with check ((select public.current_user_is_admin()) or created_by = (select auth.uid()));
create policy places_delete_admin on public.places
  for delete to authenticated
  using ((select public.current_user_is_admin()));

create policy photos_read_by_published_place on public.photos
  for select to authenticated
  using (
    uploaded_by = (select auth.uid())
    or (select public.current_user_is_admin())
    or exists (
      select 1 from public.places p
      where p.id = photos.place_id and p.moderation_status = 'published'
    )
  );
create policy photos_insert_collectors on public.photos
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select public.current_user_can_collect())
    and exists (
      select 1 from public.places p
      where p.id = photos.place_id
        and (p.created_by = (select auth.uid()) or (select public.current_user_is_admin()))
    )
  );
create policy photos_update_admin_or_owner on public.photos
  for update to authenticated
  using ((select public.current_user_is_admin()) or uploaded_by = (select auth.uid()))
  with check ((select public.current_user_is_admin()) or uploaded_by = (select auth.uid()));
create policy photos_delete_admin on public.photos
  for delete to authenticated
  using ((select public.current_user_is_admin()));

create policy ai_jobs_read_admin on public.ai_jobs
  for select to authenticated
  using ((select public.current_user_is_admin()));

create policy karma_events_read_own_or_admin on public.karma_events
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_user_is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy place_photos_storage_read_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'place-photos');
create policy place_photos_storage_insert_collectors on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and owner = (select auth.uid())
    and (select public.current_user_can_collect())
    and name ~ '^[0-9a-f-]{36}/(facade|steps|ramp|toilet|interior)\.jpg$'
  );
create policy place_photos_storage_update_owner_or_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'place-photos' and (owner = (select auth.uid()) or (select public.current_user_is_admin())))
  with check (bucket_id = 'place-photos' and (owner = (select auth.uid()) or (select public.current_user_is_admin())));
create policy place_photos_storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'place-photos' and (select public.current_user_is_admin()));
