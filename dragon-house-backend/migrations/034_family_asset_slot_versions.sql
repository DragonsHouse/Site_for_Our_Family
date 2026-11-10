-- Retain the slot row across reset, so its version never returns to an old value.
alter table family_asset_slot_assignments alter column asset_id drop not null;
insert into family_asset_slot_assignments(slot, asset_id) values ('quest_cleanup', null)
on conflict (slot) do nothing;
