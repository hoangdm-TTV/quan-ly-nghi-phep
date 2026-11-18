BEGIN;

ALTER TABLE public.out_office_requests
  ADD COLUMN IF NOT EXISTS return_document_data bytea,
  ADD COLUMN IF NOT EXISTS return_document_mime_type character varying(100),
  ADD COLUMN IF NOT EXISTS return_document_file_name character varying(180),
  ADD COLUMN IF NOT EXISTS actual_return_at timestamp with time zone;

-- Preserve the actual completion timestamp for requests completed by the old workflow.
UPDATE public.out_office_requests
   SET actual_return_at = updated_at
 WHERE status = 'COMPLETED'
   AND actual_return_at IS NULL;

ALTER TABLE public.request_change_history
  DROP CONSTRAINT IF EXISTS request_change_history_action_check;

ALTER TABLE public.request_change_history
  ALTER COLUMN action TYPE character varying(50);

ALTER TABLE public.request_change_history
  ADD CONSTRAINT request_change_history_action_check
  CHECK (
    action IN (
      'CREATED',
      'UPDATED',
      'CANCELLED',
      'RETURN_DOCUMENT_UPLOADED',
      'LEAVE_DOCUMENT_UPLOADED'
    )
  );

COMMIT;
