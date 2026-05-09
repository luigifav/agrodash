-- ============================================================
-- Agrodash - Database Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- REFERENCE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS unidades (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT        NOT NULL,
  sigla           TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS safras (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT        NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS culturas (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                TEXT    NOT NULL UNIQUE,
  unidade_padrao_id   UUID    REFERENCES unidades(id)
);

-- ============================================================
-- MAIN TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS talhoes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT        NOT NULL,
  geojson     JSONB,
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por  UUID        REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS plantios (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  talhao_id           UUID            NOT NULL REFERENCES talhoes(id) ON DELETE CASCADE,
  cultura_id          UUID            NOT NULL REFERENCES culturas(id),
  safra_id            UUID            NOT NULL REFERENCES safras(id),
  ano                 INT             NOT NULL,
  data_plantio        DATE            NOT NULL,
  data_colheita       DATE,
  area_ha             DECIMAL(10, 4)  NOT NULL,
  volume_colhido      DECIMAL(12, 4),
  unidade_id          UUID            NOT NULL REFERENCES unidades(id),
  produtividade_sc_ha DECIMAL(10, 4),
  latitude            DECIMAL(10, 7),
  longitude           DECIMAL(10, 7),
  area_unidade        TEXT NOT NULL DEFAULT 'ha',
  criado_em           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  criado_por          UUID            REFERENCES auth.users(id),
  agronomo            TEXT
);

CREATE TABLE IF NOT EXISTS uploads (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_arquivo    TEXT        NOT NULL,
  status          TEXT        NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por      UUID        REFERENCES auth.users(id)
);

-- Idempotent column adds for existing deployments (CREATE TABLE IF NOT EXISTS
-- does not add columns to a pre-existing table).
ALTER TABLE plantios ADD COLUMN IF NOT EXISTS area_unidade TEXT NOT NULL DEFAULT 'ha';
ALTER TABLE plantios ADD COLUMN IF NOT EXISTS agronomo TEXT;
ALTER TABLE plantios ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 7);
ALTER TABLE plantios ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
ALTER TABLE talhoes  ADD COLUMN IF NOT EXISTS geojson    JSONB;
ALTER TABLE talhoes  ADD COLUMN IF NOT EXISTS ativo      BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE talhoes  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- ============================================================
-- SEED DATA - UNIDADES
-- ============================================================

INSERT INTO unidades (nome, sigla) VALUES
  ('Sacas',     'sc'),
  ('Toneladas', 't')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA - SAFRAS
-- ============================================================

INSERT INTO safras (nome) VALUES
  ('Verão'),
  ('Inverno'),
  ('Safrinha')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- SEED DATA - CULTURAS
-- ============================================================

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Soja',   id FROM unidades WHERE sigla = 'sc'
ON CONFLICT (nome) DO NOTHING;

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Milho',  id FROM unidades WHERE sigla = 'sc'
ON CONFLICT (nome) DO NOTHING;

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Sorgo',  id FROM unidades WHERE sigla = 'sc'
ON CONFLICT (nome) DO NOTHING;

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Cevada', id FROM unidades WHERE sigla = 'sc'
ON CONFLICT (nome) DO NOTHING;

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Batata', id FROM unidades WHERE sigla = 't'
ON CONFLICT (nome) DO NOTHING;

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Trigo',  id FROM unidades WHERE sigla = 'sc'
ON CONFLICT (nome) DO NOTHING;

INSERT INTO culturas (nome, unidade_padrao_id)
SELECT 'Feijão', id FROM unidades WHERE sigla = 'sc'
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE unidades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE safras    ENABLE ROW LEVEL SECURITY;
ALTER TABLE culturas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE talhoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- SELECT:           qualquer usuário autenticado
-- INSERT:           qualquer usuário autenticado
-- UPDATE / DELETE:  apenas o próprio criador (criado_por = auth.uid())
--                   tabelas de referência (unidades, safras, culturas)
--                   liberam UPDATE / DELETE para qualquer autenticado.
-- ============================================================

-- Drop legacy policies (idempotent reapply)
DROP POLICY IF EXISTS "unidades_select" ON unidades;
DROP POLICY IF EXISTS "unidades_insert" ON unidades;
DROP POLICY IF EXISTS "unidades_update" ON unidades;
DROP POLICY IF EXISTS "unidades_delete" ON unidades;
DROP POLICY IF EXISTS "safras_select"   ON safras;
DROP POLICY IF EXISTS "safras_insert"   ON safras;
DROP POLICY IF EXISTS "safras_update"   ON safras;
DROP POLICY IF EXISTS "safras_delete"   ON safras;
DROP POLICY IF EXISTS "culturas_select" ON culturas;
DROP POLICY IF EXISTS "culturas_insert" ON culturas;
DROP POLICY IF EXISTS "culturas_update" ON culturas;
DROP POLICY IF EXISTS "culturas_delete" ON culturas;
DROP POLICY IF EXISTS "talhoes_select"  ON talhoes;
DROP POLICY IF EXISTS "talhoes_insert"  ON talhoes;
DROP POLICY IF EXISTS "talhoes_update"  ON talhoes;
DROP POLICY IF EXISTS "talhoes_delete"  ON talhoes;
DROP POLICY IF EXISTS "plantios_select" ON plantios;
DROP POLICY IF EXISTS "plantios_insert" ON plantios;
DROP POLICY IF EXISTS "plantios_update" ON plantios;
DROP POLICY IF EXISTS "plantios_delete" ON plantios;
DROP POLICY IF EXISTS "uploads_select"  ON uploads;
DROP POLICY IF EXISTS "uploads_insert"  ON uploads;
DROP POLICY IF EXISTS "uploads_update"  ON uploads;
DROP POLICY IF EXISTS "uploads_delete"  ON uploads;

-- SELECT (todos autenticados)
CREATE POLICY "unidades_select" ON unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "safras_select"   ON safras   FOR SELECT TO authenticated USING (true);
CREATE POLICY "culturas_select" ON culturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "talhoes_select"  ON talhoes  FOR SELECT TO authenticated USING (true);
CREATE POLICY "plantios_select" ON plantios FOR SELECT TO authenticated USING (true);
CREATE POLICY "uploads_select"  ON uploads  FOR SELECT TO authenticated USING (true);

-- unidades (tabela de referência)
CREATE POLICY "unidades_insert" ON unidades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "unidades_update" ON unidades FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "unidades_delete" ON unidades FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- safras (tabela de referência)
CREATE POLICY "safras_insert" ON safras FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "safras_update" ON safras FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "safras_delete" ON safras FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- culturas (tabela de referência)
CREATE POLICY "culturas_insert" ON culturas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "culturas_update" ON culturas FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "culturas_delete" ON culturas FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- talhoes (criado_por preenchido automaticamente via DEFAULT auth.uid())
CREATE POLICY "talhoes_insert" ON talhoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "talhoes_update" ON talhoes FOR UPDATE TO authenticated
  USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "talhoes_delete" ON talhoes FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

-- plantios
CREATE POLICY "plantios_insert" ON plantios FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "plantios_update" ON plantios FOR UPDATE TO authenticated
  USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "plantios_delete" ON plantios FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

-- uploads
CREATE POLICY "uploads_insert" ON uploads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "uploads_update" ON uploads FOR UPDATE TO authenticated
  USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "uploads_delete" ON uploads FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION resumo_producao_por_ano_cultura()
RETURNS TABLE (
  ano            INT,
  cultura        TEXT,
  total_area     NUMERIC,
  total_volume   NUMERIC,
  avg_produtividade NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    plantios.ano,
    culturas.nome        AS cultura,
    SUM(area_ha)         AS total_area,
    SUM(volume_colhido)  AS total_volume,
    AVG(produtividade_sc_ha) AS avg_produtividade
  FROM plantios
  JOIN culturas ON cultura_id = culturas.id
  GROUP BY plantios.ano, culturas.nome
  ORDER BY plantios.ano;
$$;

GRANT EXECUTE ON FUNCTION resumo_producao_por_ano_cultura() TO authenticated;

-- ============================================================
-- Force PostgREST to reload its schema cache so newly added
-- columns (e.g. latitude/longitude) become visible immediately.
-- ============================================================
NOTIFY pgrst, 'reload schema';
