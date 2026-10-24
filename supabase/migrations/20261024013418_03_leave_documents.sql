-- Leave documents: store signed leave documents as BYTEA in PostgreSQL

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS document_data BYTEA,
  ADD COLUMN IF NOT EXISTS document_mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS document_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS document_uploaded_at TIMESTAMP WITH TIME ZONE;