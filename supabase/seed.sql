-- ============================================================
-- Agrodash - Seed Data
-- ============================================================
-- Run this AFTER schema.sql.
-- Use the Supabase SQL Editor (service role) so RLS doesn't block writes.
-- Idempotent: removes previously seeded talhões/plantios by name first.
-- ============================================================

-- Remove existing seeded data (matched by talhão name) to keep this re-runnable.
DELETE FROM plantios
WHERE talhao_id IN (
  SELECT id FROM talhoes
  WHERE nome IN (
    'Talhão Boa Vista',
    'Talhão Vale Verde',
    'Talhão Cerrado Alto',
    'Talhão Aroeira',
    'Talhão Sucupira'
  )
);

DELETE FROM talhoes
WHERE nome IN (
  'Talhão Boa Vista',
  'Talhão Vale Verde',
  'Talhão Cerrado Alto',
  'Talhão Aroeira',
  'Talhão Sucupira'
);

-- ============================================================
-- TALHÕES (centro-oeste brasileiro - Mato Grosso)
-- GeoJSON: Point com coordenadas [lon, lat]
-- ============================================================

INSERT INTO talhoes (nome, geojson, ativo) VALUES
  (
    'Talhão Boa Vista',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-55.123, -13.456)
    ),
    TRUE
  ),
  (
    'Talhão Vale Verde',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-56.078, -14.225)
    ),
    TRUE
  ),
  (
    'Talhão Cerrado Alto',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-54.622, -15.987)
    ),
    TRUE
  ),
  (
    'Talhão Aroeira',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-57.345, -12.892)
    ),
    TRUE
  ),
  (
    'Talhão Sucupira',
    jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(-55.789, -16.234)
    ),
    TRUE
  );

-- ============================================================
-- PLANTIOS
-- 4 anos de histórico (2021-2024), mistura de Verão / Safrinha / Inverno
-- Soja e Milho predominantes, Trigo e Feijão complementares
-- Algumas colheitas pendentes (Inverno/2024) para popular KPI
-- ============================================================

WITH dados (
  talhao_nome, cultura_nome, safra_nome, ano,
  data_plantio, data_colheita,
  area_ha, volume_colhido, prod_sc_ha,
  lat, lng, agronomo
) AS (
  VALUES
    -- Talhão Boa Vista (120 ha)
    ('Talhão Boa Vista',  'Soja',   'Verão',    2021, DATE '2020-10-15', DATE '2021-02-18', 120.0,  7440.0,  62.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Milho',  'Safrinha', 2021, DATE '2021-02-25', DATE '2021-07-10', 120.0, 12240.0, 102.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Soja',   'Verão',    2022, DATE '2021-10-12', DATE '2022-02-15', 120.0,  8040.0,  67.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Milho',  'Safrinha', 2022, DATE '2022-02-22', DATE '2022-07-08', 120.0, 13200.0, 110.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Soja',   'Verão',    2023, DATE '2022-10-18', DATE '2023-02-22', 120.0,  8520.0,  71.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Milho',  'Safrinha', 2023, DATE '2023-02-28', DATE '2023-07-15', 120.0, 13800.0, 115.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Soja',   'Verão',    2024, DATE '2023-10-20', DATE '2024-02-25', 120.0,  8760.0,  73.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Milho',  'Safrinha', 2024, DATE '2024-03-01', DATE '2024-07-18', 120.0, 14160.0, 118.0, -13.456, -55.123, 'João Silva'),
    ('Talhão Boa Vista',  'Trigo',  'Inverno',  2024, DATE '2024-08-10', NULL,               80.0,  NULL,    NULL,  -13.456, -55.123, 'João Silva'),

    -- Talhão Vale Verde (250 ha)
    ('Talhão Vale Verde', 'Soja',   'Verão',    2021, DATE '2020-10-10', DATE '2021-02-15', 250.0, 15000.0,  60.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Milho',  'Safrinha', 2021, DATE '2021-02-22', DATE '2021-07-05', 250.0, 23750.0,  95.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Soja',   'Verão',    2022, DATE '2021-10-08', DATE '2022-02-10', 250.0, 16000.0,  64.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Milho',  'Safrinha', 2022, DATE '2022-02-20', DATE '2022-07-02', 250.0, 26250.0, 105.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Soja',   'Verão',    2023, DATE '2022-10-13', DATE '2023-02-18', 250.0, 17000.0,  68.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Milho',  'Safrinha', 2023, DATE '2023-02-25', DATE '2023-07-12', 250.0, 28000.0, 112.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Soja',   'Verão',    2024, DATE '2023-10-15', DATE '2024-02-20', 250.0, 17500.0,  70.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Milho',  'Safrinha', 2024, DATE '2024-02-28', DATE '2024-07-15', 250.0, 30000.0, 120.0, -14.225, -56.078, 'Maria Pereira'),
    ('Talhão Vale Verde', 'Feijão', 'Inverno',  2024, DATE '2024-08-15', NULL,              100.0,  NULL,    NULL,  -14.225, -56.078, 'Maria Pereira'),

    -- Talhão Cerrado Alto (180 ha)
    ('Talhão Cerrado Alto','Soja',  'Verão',    2021, DATE '2020-10-20', DATE '2021-02-25', 180.0,  9900.0,  55.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Milho', 'Safrinha', 2021, DATE '2021-03-02', DATE '2021-07-15', 180.0, 16560.0,  92.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Soja',  'Verão',    2022, DATE '2021-10-18', DATE '2022-02-22', 180.0, 10440.0,  58.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Milho', 'Safrinha', 2022, DATE '2022-02-28', DATE '2022-07-12', 180.0, 17640.0,  98.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Soja',  'Verão',    2023, DATE '2022-10-22', DATE '2023-02-28', 180.0, 11340.0,  63.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Milho', 'Safrinha', 2023, DATE '2023-03-05', DATE '2023-07-18', 180.0, 18900.0, 105.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Trigo', 'Inverno',  2023, DATE '2023-08-05', DATE '2023-11-10',  60.0,  2700.0,  45.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Soja',  'Verão',    2024, DATE '2023-10-25', DATE '2024-03-02', 180.0, 11880.0,  66.0, -15.987, -54.622, 'Carlos Almeida'),
    ('Talhão Cerrado Alto','Milho', 'Safrinha', 2024, DATE '2024-03-08', DATE '2024-07-22', 180.0, 19800.0, 110.0, -15.987, -54.622, 'Carlos Almeida'),

    -- Talhão Aroeira (90 ha)
    ('Talhão Aroeira',    'Soja',   'Verão',    2021, DATE '2020-10-08', DATE '2021-02-12',  90.0,  6300.0,  70.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Milho',  'Safrinha', 2021, DATE '2021-02-18', DATE '2021-07-02',  90.0,  9720.0, 108.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Soja',   'Verão',    2022, DATE '2021-10-05', DATE '2022-02-08',  90.0,  6480.0,  72.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Milho',  'Safrinha', 2022, DATE '2022-02-15', DATE '2022-06-30',  90.0, 10350.0, 115.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Soja',   'Verão',    2023, DATE '2022-10-10', DATE '2023-02-15',  90.0,  6570.0,  73.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Milho',  'Safrinha', 2023, DATE '2023-02-20', DATE '2023-07-08',  90.0, 10980.0, 122.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Soja',   'Verão',    2024, DATE '2023-10-12', DATE '2024-02-17',  90.0,  6750.0,  75.0, -12.892, -57.345, 'Ana Costa'),
    ('Talhão Aroeira',    'Milho',  'Safrinha', 2024, DATE '2024-02-25', DATE '2024-07-10',  90.0, 11520.0, 128.0, -12.892, -57.345, 'Ana Costa'),

    -- Talhão Sucupira (320 ha)
    ('Talhão Sucupira',   'Soja',   'Verão',    2021, DATE '2020-10-25', DATE '2021-03-02', 320.0, 16640.0,  52.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Milho',  'Safrinha', 2021, DATE '2021-03-08', DATE '2021-07-22', 320.0, 28800.0,  90.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Soja',   'Verão',    2022, DATE '2021-10-22', DATE '2022-02-28', 320.0, 17920.0,  56.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Milho',  'Safrinha', 2022, DATE '2022-03-05', DATE '2022-07-18', 320.0, 30720.0,  96.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Feijão', 'Inverno',  2022, DATE '2022-08-12', DATE '2022-11-15',  70.0,  2240.0,  32.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Soja',   'Verão',    2023, DATE '2022-10-28', DATE '2023-03-05', 320.0, 19520.0,  61.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Milho',  'Safrinha', 2023, DATE '2023-03-10', DATE '2023-07-25', 320.0, 32640.0, 102.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Soja',   'Verão',    2024, DATE '2023-11-02', DATE '2024-03-08', 320.0, 20800.0,  65.0, -16.234, -55.789, 'Pedro Ramos'),
    ('Talhão Sucupira',   'Milho',  'Safrinha', 2024, DATE '2024-03-12', DATE '2024-07-28', 320.0, 33600.0, 105.0, -16.234, -55.789, 'Pedro Ramos')
)
INSERT INTO plantios (
  talhao_id, cultura_id, safra_id, ano,
  data_plantio, data_colheita,
  area_ha, volume_colhido, unidade_id,
  produtividade_sc_ha, latitude, longitude,
  area_unidade, agronomo
)
SELECT
  t.id,
  c.id,
  s.id,
  d.ano,
  d.data_plantio,
  d.data_colheita,
  d.area_ha,
  d.volume_colhido,
  u.id,
  d.prod_sc_ha,
  d.lat,
  d.lng,
  'ha',
  d.agronomo
FROM dados d
JOIN talhoes  t ON t.nome  = d.talhao_nome
JOIN culturas c ON c.nome  = d.cultura_nome
JOIN safras   s ON s.nome  = d.safra_nome
JOIN unidades u ON u.sigla = 'sc';

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
