-- Seed data for Supabase preview branches
-- This file runs automatically when preview branches are created
--
-- Note: We create stub products to satisfy FK constraints since
-- the full items.product table is not seeded (56K+ rows)

BEGIN;

-- ============================================================================
-- 1. CREATE STUB PRODUCTS (minimal data to satisfy FK constraints)
-- ============================================================================
-- These are placeholder products just to allow project_products to reference them

INSERT INTO items.product (id, item_code, description, created_at)
VALUES
  ('04f9afbb-d6aa-41ae-8a40-47cda1679bbf', 'SEED-001', 'Seed Product 1', NOW()),
  ('8f151494-351c-4693-8391-c43e5a39bdc7', 'SEED-002', 'Seed Product 2', NOW()),
  ('096b9210-8afa-46a0-8260-2603f82f1dda', 'SEED-003', 'Seed Product 3', NOW()),
  ('d0de8818-cb0b-4402-980f-8190d6137c45', 'SEED-004', 'Seed Product 4', NOW()),
  ('0bd1ebe6-d1ee-4308-aad0-972f7c5c812a', 'SEED-005', 'Seed Product 5', NOW()),
  ('4b5a9a63-093e-4505-a9f4-c77bbc9bbe34', 'SEED-006', 'Seed Product 6', NOW()),
  ('000b2d33-b1a5-401a-a906-16b4d1dd2c82', 'SEED-007', 'Seed Product 7', NOW()),
  ('568a702e-defd-40d5-a880-66885ec07bfa', 'SEED-008', 'Seed Product 8', NOW()),
  ('2e0afff0-7def-4c4b-92fa-700873324675', 'SEED-009', 'Seed Product 9', NOW()),
  ('fd9b9eba-27e6-403a-bf2e-0f2ec9cf8e4f', 'SEED-010', 'Seed Product 10', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. CUSTOMERS
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

-- ============================================================================
-- 5. PROJECT PRODUCTS
-- ============================================================================

INSERT INTO projects.project_products (
  id, project_id, product_id, quantity, unit_price, discount_percent,
  total_price, room_location, mounting_height, notes, status, added_at, updated_at
)
VALUES
  -- Project: Fashion Gallery Clothing Store
  ('963c5f82-bb30-47f4-b7dd-c54810e48204', '112f3fb5-17b6-4a5d-a04c-44d6e54799b9', '000b2d33-b1a5-401a-a906-16b4d1dd2c82', 3, 242.35, 60, 290.82, NULL, NULL, NULL, 'specified', '2025-12-18T09:57:34.658088+00:00', '2025-12-18T09:58:07.518171+00:00'),
  ('88d6b8e6-92e4-4914-bd64-58408d878c25', '112f3fb5-17b6-4a5d-a04c-44d6e54799b9', '04f9afbb-d6aa-41ae-8a40-47cda1679bbf', 2, 2515.23, 60, 2012.184, NULL, NULL, NULL, 'specified', '2025-12-18T09:57:49.43266+00:00', '2025-12-18T09:58:08.691548+00:00'),

  -- Project: Μανος
  ('51d563b9-8e04-48e7-9c6a-e5a2f6b5a82b', '06c4f725-5678-4e65-a8a4-3c5204cf5858', '8f151494-351c-4693-8391-c43e5a39bdc7', 25, 89.54, 60, 895.4, NULL, NULL, NULL, 'specified', '2025-12-16T15:15:12.484572+00:00', '2025-12-16T15:26:00.981552+00:00'),
  ('a5216f10-f61a-4348-ac64-ac95c0830d25', '06c4f725-5678-4e65-a8a4-3c5204cf5858', 'fd9b9eba-27e6-403a-bf2e-0f2ec9cf8e4f', 7, 292.08, 60, 817.824, NULL, NULL, NULL, 'specified', '2025-12-16T15:16:00.650639+00:00', '2025-12-16T15:26:08.341234+00:00'),
  ('b1def2ee-937c-4308-973f-51adcaf53113', '06c4f725-5678-4e65-a8a4-3c5204cf5858', '568a702e-defd-40d5-a880-66885ec07bfa', 17, 267.08, 60, 1816.144, NULL, NULL, NULL, 'specified', '2025-12-16T15:17:03.212131+00:00', '2025-12-16T15:26:33.365183+00:00'),
  ('db74c998-6921-44ce-9cb8-6f9a82ac2eeb', '06c4f725-5678-4e65-a8a4-3c5204cf5858', 'd0de8818-cb0b-4402-980f-8190d6137c45', 6, 189.45, 60, 454.68, NULL, NULL, NULL, 'specified', '2025-12-16T15:20:13.736297+00:00', '2025-12-16T15:28:26.642592+00:00'),
  ('38cae83f-761e-4622-bd74-9bdfb121a057', '06c4f725-5678-4e65-a8a4-3c5204cf5858', '0bd1ebe6-d1ee-4308-aad0-972f7c5c812a', 32, 32.43, 60, 415.104, NULL, NULL, NULL, 'specified', '2025-12-16T15:22:56.998097+00:00', '2025-12-16T15:28:51.167218+00:00'),
  ('544cf21c-f4a3-4687-98a3-aa1685de1df0', '06c4f725-5678-4e65-a8a4-3c5204cf5858', '2e0afff0-7def-4c4b-92fa-700873324675', 4, 76.77, 60, 122.832, NULL, NULL, NULL, 'specified', '2025-12-16T15:24:08.496473+00:00', '2025-12-16T15:29:18.094984+00:00'),
  ('0a2caa26-ec67-4d8e-9c14-44deebc8eebb', '06c4f725-5678-4e65-a8a4-3c5204cf5858', '096b9210-8afa-46a0-8260-2603f82f1dda', 4, 105.11, 60, 168.176, NULL, NULL, NULL, 'specified', '2025-12-16T15:24:47.393205+00:00', '2025-12-16T15:29:23.409294+00:00'),
  ('9f77885c-4d81-4838-bc63-198bb4cc038b', '06c4f725-5678-4e65-a8a4-3c5204cf5858', '4b5a9a63-093e-4505-a9f4-c77bbc9bbe34', 1, 167.83, 60, 67.132, NULL, NULL, NULL, 'specified', '2025-12-16T16:12:51.545547+00:00', '2025-12-16T16:12:51.545547+00:00')
ON CONFLICT (id) DO NOTHING;

COMMIT;
