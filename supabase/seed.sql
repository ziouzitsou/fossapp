-- Seed data for Supabase preview branches
-- This file runs automatically when preview branches are created
--
-- Note: We only seed customers, projects, and versions.
-- Products/project_products are NOT seeded due to complex FK dependencies.

BEGIN;

-- ============================================================================
-- 1. CUSTOMERS
-- ============================================================================

INSERT INTO customers.customers (id, customer_code, name, name_en, country, data_source, created_at, updated_at)
VALUES
  ('41cf8ea0-ccb8-4da3-b548-fd0fcdecaaf3', '009341', 'TECHGROUP ΥΠΟΣΤΗΡΙΞΗ CNC ΣΥΣΤΗΜΑΤΩΝ ΒΙΟΜΗΧΑΝΙΚΟΣ ΕΞΟΠΛΙΣΜΟΣ ΕΠΕ', 'TECHGROUP CNC SYSTEMS SUPPORT INDUSTRIAL EQUIPMENT Ltd', 'Greece', 'csv_import', '2025-11-10T16:05:11.292216+00:00', '2025-11-10T16:05:11.292216+00:00'),
  ('d8e41155-61b5-4fef-bae9-ce6f20567d2c', '004655', 'ΠΕΤΡΑΚΑΚΗΣ ΜΑΝΟΣ', 'Petrakakis Manos', 'Greece', 'csv_import', '2025-11-10T15:47:32.815489+00:00', '2025-11-10T15:47:32.815489+00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. PROJECTS
-- ============================================================================

INSERT INTO projects.projects (
  id, project_code, name, name_en, description, customer_id,
  street_address, city, country, project_type, project_category,
  building_area_sqm, estimated_budget, currency, status, priority,
  start_date, expected_completion_date, project_manager, architect_firm,
  electrical_engineer, lighting_designer, notes, tags, data_source,
  created_at, updated_at, google_drive_folder_id, current_version, is_archived
)
VALUES
  (
    '112f3fb5-17b6-4a5d-a04c-44d6e54799b9', '2512-001', 'Fashion Gallery Clothing Store', NULL,
    'Test project creation', '41cf8ea0-ccb8-4da3-b548-fd0fcdecaaf3',
    'Dexamenis 8', 'Athens', 'Greece', 'office', 'Renovation',
    120, 5000, 'EUR', 'draft', 'medium',
    '2025-12-16', '2026-01-31', 'Manos', 'Foufoutos',
    'A general FOSS engineer?', 'A general FOSS designer (from database?)',
    'Very difficult customer, never pays', '{}', 'manual_entry',
    '2025-12-16T14:04:25.57564+00:00', '2025-12-18T09:58:35.62108+00:00',
    '1PYj186Z7OhGLb69qqXUVhtuW7KBNGBh5', 1, false
  ),
  (
    '06c4f725-5678-4e65-a8a4-3c5204cf5858', '2512-002', 'Μανος', NULL,
    NULL, 'd8e41155-61b5-4fef-bae9-ce6f20567d2c',
    NULL, NULL, 'Greece', 'residential', NULL,
    NULL, 30000, 'EUR', 'draft', 'medium',
    '2025-12-16', NULL, NULL, NULL,
    NULL, NULL, NULL, '{}', 'manual_entry',
    '2025-12-16T15:07:03.155531+00:00', '2025-12-18T09:50:12.241831+00:00',
    '1RHC3lNjJwPlPVXofY4Q2dDSYQeJReKHb', 1, false
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. PROJECT VERSIONS
-- ============================================================================

INSERT INTO projects.project_versions (id, project_id, version_number, google_drive_folder_id, created_at, created_by, notes)
VALUES
  ('a9417a7c-d0cb-4202-bb6a-a9d8094fa957', '112f3fb5-17b6-4a5d-a04c-44d6e54799b9', 1, '15EgrLLiVPa70lhufZN2su6lTC7IJ3P1n', '2025-12-16T14:04:32.954423+00:00', NULL, 'Initial version'),
  ('b3b89a61-a0f3-4b95-842b-ea5f82297f6e', '06c4f725-5678-4e65-a8a4-3c5204cf5858', 1, '1ZlcDiwVeny3ilR4bP49iHTU-Y-rTRbnm', '2025-12-16T15:07:09.791003+00:00', NULL, 'Initial version')
ON CONFLICT (id) DO NOTHING;

COMMIT;
