-- ============================================================================
-- MIGRATION: TÊN ĐĂNG NHẬP RIÊNG, KHÔNG PHẢI EMAIL
-- Chạy sau migrations/000_initial_database.sql trên database hiện có.
-- Không thay đổi cột users.email; có thể đổi login_username tùy ý sau này.
-- ============================================================================
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login_username character varying(100);

-- Từ chối chạy nếu phần trước @ bị trùng giữa các email công ty,
-- vì khi đó không thể tạo username mặc định duy nhất.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.users
     WHERE LOWER(email) LIKE '%@trithucvietbn.com'
     GROUP BY LOWER(SPLIT_PART(email, '@', 1))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Có email công ty trùng phần tên trước @; hãy xử lý trùng username trước khi chạy migration.';
  END IF;
END
$$;

-- Dùng local-part làm username ban đầu (ví dụ hoangdm), nhưng chỉ điền
-- những dòng chưa có username để không ghi đè tên đăng nhập đã tùy chỉnh.
UPDATE public.users
   SET login_username = LOWER(SPLIT_PART(email, '@', 1))
 WHERE LOWER(email) LIKE '%@trithucvietbn.com'
   AND login_username IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.users
     WHERE login_username IS NOT NULL
     GROUP BY LOWER(BTRIM(login_username))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'login_username bị trùng; hãy sửa các username trùng trước khi tạo unique index.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.users
     WHERE login_username IS NOT NULL
       AND (BTRIM(login_username) = '' OR LENGTH(login_username) > 100)
  ) THEN
    RAISE EXCEPTION 'login_username phải có từ 1 đến 100 ký tự và không được để trống.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_login_username_lower_unique_idx
  ON public.users (LOWER(BTRIM(login_username)))
  WHERE login_username IS NOT NULL;

COMMENT ON COLUMN public.users.login_username IS
  'Tên đăng nhập tùy chọn, duy nhất không phân biệt hoa thường; không thay thế email liên hệ.';

-- Kiểm tra kết quả sau khi chạy; email vẫn được giữ nguyên.
SELECT login_username, email, full_name
  FROM public.users
 WHERE login_username IS NOT NULL
 ORDER BY login_username;

COMMIT;
