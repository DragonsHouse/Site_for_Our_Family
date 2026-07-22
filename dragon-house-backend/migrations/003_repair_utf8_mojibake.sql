create or replace function family_repair_mojibake_text(value text)
returns text
language plpgsql
immutable
strict
as $$
declare
  repaired text;
begin
  repaired := convert_from(convert_to(value, 'WIN1251'), 'UTF8');
  if position(chr(65533) in repaired) > 0 then
    return value;
  end if;
  return repaired;
exception
  when others then
    return value;
end;
$$;

create or replace function family_repair_mojibake_jsonb(value jsonb)
returns jsonb
language sql
immutable
strict
as $$
  select case jsonb_typeof(value)
    when 'string' then to_jsonb(family_repair_mojibake_text(value #>> '{}'))
    when 'array' then (
      select coalesce(jsonb_agg(family_repair_mojibake_jsonb(item.value) order by item.ordinality), '[]'::jsonb)
      from jsonb_array_elements(value) with ordinality as item(value, ordinality)
    )
    when 'object' then (
      select coalesce(jsonb_object_agg(item.key, family_repair_mojibake_jsonb(item.value)), '{}'::jsonb)
      from jsonb_each(value) as item(key, value)
    )
    else value
  end
$$;

update family_members
set nickname = family_repair_mojibake_text(nickname),
    static_id = family_repair_mojibake_text(static_id),
    notes = case when notes is null then null else family_repair_mojibake_text(notes) end,
    permissions = family_repair_mojibake_jsonb(permissions),
    permissions_override = family_repair_mojibake_jsonb(permissions_override),
    onboarding_metadata = family_repair_mojibake_jsonb(onboarding_metadata),
    profile_metadata = family_repair_mojibake_jsonb(profile_metadata),
    updated_at = case
      when nickname is distinct from family_repair_mojibake_text(nickname)
        or static_id is distinct from family_repair_mojibake_text(static_id)
        or notes is distinct from case when notes is null then null else family_repair_mojibake_text(notes) end
        or permissions is distinct from family_repair_mojibake_jsonb(permissions)
        or permissions_override is distinct from family_repair_mojibake_jsonb(permissions_override)
        or onboarding_metadata is distinct from family_repair_mojibake_jsonb(onboarding_metadata)
        or profile_metadata is distinct from family_repair_mojibake_jsonb(profile_metadata)
      then now()
      else updated_at
    end
where nickname is distinct from family_repair_mojibake_text(nickname)
   or static_id is distinct from family_repair_mojibake_text(static_id)
   or notes is distinct from case when notes is null then null else family_repair_mojibake_text(notes) end
   or permissions is distinct from family_repair_mojibake_jsonb(permissions)
   or permissions_override is distinct from family_repair_mojibake_jsonb(permissions_override)
   or onboarding_metadata is distinct from family_repair_mojibake_jsonb(onboarding_metadata)
   or profile_metadata is distinct from family_repair_mojibake_jsonb(profile_metadata);

update family_auth_users
set login = family_repair_mojibake_text(login),
    static_id = family_repair_mojibake_text(static_id),
    permissions = family_repair_mojibake_jsonb(permissions),
    updated_at = case
      when login is distinct from family_repair_mojibake_text(login)
        or static_id is distinct from family_repair_mojibake_text(static_id)
        or permissions is distinct from family_repair_mojibake_jsonb(permissions)
      then now()
      else updated_at
    end
where login is distinct from family_repair_mojibake_text(login)
   or static_id is distinct from family_repair_mojibake_text(static_id)
   or permissions is distinct from family_repair_mojibake_jsonb(permissions);

update family_audit_log
set before_data = case when before_data is null then null else family_repair_mojibake_jsonb(before_data) end,
    after_data = case when after_data is null then null else family_repair_mojibake_jsonb(after_data) end,
    metadata = case when metadata is null then null else family_repair_mojibake_jsonb(metadata) end
where before_data is distinct from case when before_data is null then null else family_repair_mojibake_jsonb(before_data) end
   or after_data is distinct from case when after_data is null then null else family_repair_mojibake_jsonb(after_data) end
   or metadata is distinct from case when metadata is null then null else family_repair_mojibake_jsonb(metadata) end;
