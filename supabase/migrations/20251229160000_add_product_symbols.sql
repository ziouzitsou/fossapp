-- Migration: Add product_symbols table for symbol image storage
-- Part of Planner Phase 4: Symbol Images
--
-- This table stores generated AutoCAD symbol images for products.
-- Symbols are generated on-demand and cached with their source hash
-- for regeneration detection when product data changes.

-- ============================================================================
-- 1. Create the product_symbols table
-- ============================================================================
CREATE TABLE items.product_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identifier (immutable reference)
  foss_pid TEXT NOT NULL UNIQUE,

  -- Current classification (can change if rules updated)
  symbol_code CHAR(1),

  -- Storage paths (relative to 'product-symbols' bucket)
  dwg_path TEXT,                           -- '{foss_pid}/symbol.dwg'
  png_path TEXT,                           -- '{foss_pid}/symbol.png'
  svg_path TEXT,                           -- '{foss_pid}/symbol.svg' (optional)

  -- Generation metadata
  generated_at TIMESTAMPTZ,
  generation_model TEXT,                   -- 'claude-sonnet-4' etc.

  -- For regeneration detection
  -- Hash of: dimensions + photo URLs used for generation
  input_hash TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by foss_pid
CREATE INDEX idx_product_symbols_foss_pid ON items.product_symbols(foss_pid);

-- Index for finding products by symbol code (for admin/reporting)
CREATE INDEX idx_product_symbols_code ON items.product_symbols(symbol_code);

-- Comment on table and columns
COMMENT ON TABLE items.product_symbols IS 'Stores generated AutoCAD symbol images for products. Part of Planner Phase 4.';
COMMENT ON COLUMN items.product_symbols.foss_pid IS 'Immutable product identifier from items.product';
COMMENT ON COLUMN items.product_symbols.symbol_code IS 'Single letter classification (A, B, C...) from symbol_rules';
COMMENT ON COLUMN items.product_symbols.dwg_path IS 'Path to AutoCAD DWG file in product-symbols bucket';
COMMENT ON COLUMN items.product_symbols.png_path IS 'Path to PNG preview in product-symbols bucket';
COMMENT ON COLUMN items.product_symbols.svg_path IS 'Path to SVG (web-friendly) in product-symbols bucket';
COMMENT ON COLUMN items.product_symbols.input_hash IS 'SHA256 hash of inputs used for generation, for regeneration detection';

-- ============================================================================
-- 2. Create updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION items.update_product_symbols_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_symbols_updated_at
  BEFORE UPDATE ON items.product_symbols
  FOR EACH ROW
  EXECUTE FUNCTION items.update_product_symbols_updated_at();

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================
ALTER TABLE items.product_symbols ENABLE ROW LEVEL SECURITY;

-- Read access: authenticated users can view all symbols
CREATE POLICY "Authenticated users can view product symbols"
  ON items.product_symbols
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert/Update: Only service role (via server actions)
-- No policy needed - service_role bypasses RLS

-- ============================================================================
-- 4. Helper function to check if symbol needs regeneration
-- ============================================================================
CREATE OR REPLACE FUNCTION items.symbol_needs_regeneration(
  p_foss_pid TEXT,
  p_input_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_existing_hash TEXT;
BEGIN
  SELECT input_hash INTO v_existing_hash
  FROM items.product_symbols
  WHERE foss_pid = p_foss_pid;

  -- Needs regeneration if:
  -- 1. No record exists
  -- 2. No files generated yet (png_path is null)
  -- 3. Input hash has changed
  IF v_existing_hash IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_existing_hash IS DISTINCT FROM p_input_hash;
END;
$$;

COMMENT ON FUNCTION items.symbol_needs_regeneration IS 'Check if a product symbol needs to be (re)generated based on input hash';
