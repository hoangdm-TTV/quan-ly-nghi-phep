-- =============================================================================
-- Migration: 03_leave_documents.sql
-- Mô tả: Lưu giấy nghỉ phép đã ký dưới dạng BYTEA riêng tư trong PostgreSQL.
-- Chạy sau 01_initial_schema.sql và 02_auth_and_extensions.sql.
-- =============================================================================

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS document_data BYTEA,
  ADD COLUMN IF NOT EXISTS document_mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS document_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS document_uploaded_at TIMESTAMP WITH TIME ZONE;
