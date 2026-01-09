-- Add symbol rule for Street / Pole Lights (EC000062)
-- Symbol letter: J

INSERT INTO items.symbol_rules (
  symbol,
  name,
  description,
  etim_group,
  etim_class,
  etim_class_desc,
  priority,
  is_active
) VALUES (
  'J',
  'Street / Pole Lights',
  'Street and pole-mounted luminaires',
  'EG000027',
  'EC000062',
  'Street luminaire',
  100,
  true
) ON CONFLICT DO NOTHING;
