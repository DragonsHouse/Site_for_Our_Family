INSERT INTO family_towers (
  id,
  tower_code,
  name,
  location_label,
  map_metadata,
  image_asset_id,
  icon_asset_id,
  is_active,
  external_source,
  external_id,
  metadata
) VALUES
  (
    '00000000-0000-4000-8000-000000000201',
    'VSP-04',
    'Vespucci Signal Tower',
    'Vespucci / western signal line',
    '{"x":24.4,"y":71.8,"zone":"West Coast","backendMapId":"map_tower_vespucci"}'::jsonb,
    NULL,
    NULL,
    TRUE,
    'frontend_mock_seed',
    'tower-vespucci',
    '{"seed":"tower-defense-mock-data","backendLocationId":"tower_location_vespucci","visual":{"icon":"Tower","markerColor":"ember"}}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'SND-11',
    'Sandy Shores Relay',
    'Sandy Shores / north relay',
    '{"x":63.2,"y":41.1,"zone":"Desert","backendMapId":"map_tower_sandy"}'::jsonb,
    NULL,
    NULL,
    TRUE,
    'frontend_mock_seed',
    'tower-sandy',
    '{"seed":"tower-defense-mock-data","backendLocationId":"tower_location_sandy","visual":{"icon":"Radio","markerColor":"amber"}}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'PLT-02',
    'Paleto Ridge Tower',
    'Paleto Ridge',
    '{"x":42.7,"y":13.6,"zone":"North","backendMapId":"map_tower_paleto"}'::jsonb,
    NULL,
    NULL,
    TRUE,
    'frontend_mock_seed',
    'tower-paleto',
    '{"seed":"tower-defense-mock-data","backendLocationId":"tower_location_paleto","visual":{"icon":"Shield","markerColor":"crimson"}}'::jsonb
  )
ON CONFLICT (tower_code) DO NOTHING;
