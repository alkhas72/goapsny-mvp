-- T3: atomic verified-place publish (place + facade photo row in one transaction).
-- FIELD-DELTA: SECURITY DEFINER with empty search_path and fully qualified names.

create or replace function public.auditor_publish_verified_place(
  p_place_id uuid,
  p_name text,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_status text,
  p_steps_count smallint,
  p_step_height_cm smallint,
  p_ramp_type text,
  p_door_width_cm smallint,
  p_entrance_notes text,
  p_toilet_exists text,
  p_toilet_accessible text,
  p_parking text,
  p_comment text,
  p_details jsonb,
  p_created_by uuid,
  p_storage_path text,
  p_uploaded_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('green', 'yellow', 'red') then
    raise exception 'invalid_status';
  end if;
  if p_ramp_type not in ('none', 'permanent', 'portable_on_request', 'portable_available') then
    raise exception 'invalid_ramp_type';
  end if;
  if p_toilet_exists not in ('yes', 'no', 'unknown') then
    raise exception 'invalid_toilet_exists';
  end if;
  if p_toilet_accessible not in ('yes', 'no', 'partial', 'unknown') then
    raise exception 'invalid_toilet_accessible';
  end if;
  if p_parking not in ('yes', 'no', 'unknown') then
    raise exception 'invalid_parking';
  end if;
  if p_storage_path <> (p_place_id::text || '/facade.jpg') then
    raise exception 'invalid_facade_path';
  end if;

  insert into public.places (
    id,
    name,
    category,
    lat,
    lng,
    status,
    steps_count,
    step_height_cm,
    ramp_type,
    door_width_cm,
    entrance_notes,
    toilet_exists,
    toilet_accessible,
    parking,
    comment,
    details,
    moderation_status,
    source,
    created_by
  )
  values (
    p_place_id,
    p_name,
    p_category,
    p_lat,
    p_lng,
    p_status,
    p_steps_count,
    p_step_height_cm,
    p_ramp_type,
    p_door_width_cm,
    p_entrance_notes,
    p_toilet_exists,
    p_toilet_accessible,
    p_parking,
    p_comment,
    p_details,
    'published',
    'operator',
    p_created_by
  );

  insert into public.photos (
    place_id,
    storage_path,
    kind,
    uploaded_by
  )
  values (
    p_place_id,
    p_storage_path,
    'facade',
    p_uploaded_by
  );

  return p_place_id;
end;
$$;

revoke all on function public.auditor_publish_verified_place(
  uuid, text, text, double precision, double precision, text,
  smallint, smallint, text, smallint, text, text, text, text, text,
  jsonb, uuid, text, uuid
) from public;

revoke all on function public.auditor_publish_verified_place(
  uuid, text, text, double precision, double precision, text,
  smallint, smallint, text, smallint, text, text, text, text, text,
  jsonb, uuid, text, uuid
) from anon;

revoke all on function public.auditor_publish_verified_place(
  uuid, text, text, double precision, double precision, text,
  smallint, smallint, text, smallint, text, text, text, text, text,
  jsonb, uuid, text, uuid
) from authenticated;

grant execute on function public.auditor_publish_verified_place(
  uuid, text, text, double precision, double precision, text,
  smallint, smallint, text, smallint, text, text, text, text, text,
  jsonb, uuid, text, uuid
) to service_role;
