-- AISP-336: fields the export standard needs (OSM tags, Google/Apple/Yandex business profiles).
-- Additive and nullable: existing rows and the current submit RPC are untouched.

alter table public.places
  add column if not exists entrance_type text
    check (entrance_type is null or entrance_type in ('main', 'side', 'service', 'ramp_only', 'unknown')),
  add column if not exists kerb_height_cm smallint
    check (kerb_height_cm is null or kerb_height_cm >= 0),
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists external_ids jsonb not null default '{}'::jsonb
    check (jsonb_typeof(external_ids) = 'object'),
  add column if not exists inspected_at date;

comment on column public.places.entrance_type is 'OSM entrance=*: main, side, service; ramp_only when the only step-free way in is a separate ramp entrance.';
comment on column public.places.kerb_height_cm is 'OSM kerb:height in cm, measured at the entrance.';
comment on column public.places.address is 'Free-form address as written on site; split into addr:* tags at export.';
comment on column public.places.external_ids is 'Identifiers on other platforms, e.g. {"osm":"node/123","google_place_id":"...","yandex_org_id":"..."}.';
comment on column public.places.inspected_at is 'Date of the on-site inspection (OSM check_date:wheelchair).';
