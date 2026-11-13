-- ============================================================================
-- KHỞI TẠO DATABASE QUẢN LÝ NGHỈ PHÉP & RA NGOÀI
-- ============================================================================
-- File này tạo database từ đầu trên một PostgreSQL database đang rỗng.
-- Nội dung gồm: extension, bảng, dữ liệu ban đầu, index, constraint,
-- khóa ngoại và các câu kiểm tra sau khi khởi tạo.
--
-- Cách chạy: kết nối đúng database đích và chạy toàn bộ file bằng
-- DBeaver > Execute SQL Script hoặc bằng psql.
-- Chỉ chạy một lần trên database mới; không chạy trên database đã có schema.
-- ============================================================================
BEGIN;

-- Khởi động transaction và thiết lập cấu hình an toàn cho database.


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
-- Không sử dụng search_path ngầm định trong quá trình khởi tạo.
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Extension cần thiết cho UUID và mã hóa mật khẩu.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';

SET default_tablespace = '';

SET default_table_access_method = heap;

-- Bảng approval_history: Lịch sử phê duyệt đơn nghỉ và đơn ra ngoài.
CREATE TABLE public.approval_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type character varying(50) NOT NULL,
    request_id uuid NOT NULL,
    approver_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_history_action_check CHECK (((action)::text = ANY ((ARRAY['APPROVED_LEAD'::character varying, 'APPROVED_DIRECTOR'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT approval_history_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['LEAVE'::character varying, 'OUT_OFFICE'::character varying])::text[])))
);

-- Bảng audit_logs: Nhật ký thay đổi dữ liệu quan trọng.
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action character varying(80) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Bảng departments: Danh sách phòng ban.
CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL
);

-- Bảng holidays: Danh sách ngày nghỉ lễ.
CREATE TABLE public.holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_holiday_dates CHECK ((end_date >= start_date))
);

-- Bảng leave_entitlements: Hạn mức và số ngày phép của nhân viên.
CREATE TABLE public.leave_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_year integer NOT NULL,
    entitled_days numeric(6,1) NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_entitlements_entitled_days_check CHECK ((entitled_days >= (0)::numeric)),
    CONSTRAINT leave_entitlements_leave_year_check CHECK (((leave_year >= 2000) AND (leave_year <= 2200)))
);

-- Bảng leave_requests: Đơn xin nghỉ phép.
CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    duration_days numeric(4,1) NOT NULL,
    reason text,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    document_url text,
    document_data bytea,
    document_mime_type character varying(100),
    document_file_name character varying(255),
    document_uploaded_at timestamp with time zone,
    approver_id uuid,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    day_part character varying(20) DEFAULT 'FULL_DAY'::character varying NOT NULL,
    replacement_user_id uuid,
    handover_note text,
    CONSTRAINT chk_leave_dates CHECK ((end_date >= start_date)),
    CONSTRAINT chk_leave_duration CHECK ((duration_days > (0)::numeric)),
    CONSTRAINT leave_requests_day_part_check CHECK (((day_part)::text = ANY ((ARRAY['FULL_DAY'::character varying, 'MORNING'::character varying, 'AFTERNOON'::character varying])::text[]))),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'WAITING_FOR_DOC'::character varying, 'COMPLETED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[])))
);

-- Bảng login_rate_limits: Giới hạn số lần đăng nhập thất bại.
CREATE TABLE public.login_rate_limits (
    rate_key character(64) NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT login_rate_limits_failed_attempts_check CHECK ((failed_attempts >= 0))
);

-- Bảng notifications: Thông báo nội bộ trong ứng dụng.
CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) DEFAULT 'SYSTEM'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    url text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Bảng out_office_requests: Đơn xin ra ngoài.
CREATE TABLE public.out_office_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    request_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    estimated_hours numeric(4,2) NOT NULL,
    reason_type character varying(50) NOT NULL,
    reason text,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    approver_id uuid,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_out_office_hours CHECK ((estimated_hours > (0)::numeric)),
    CONSTRAINT chk_out_office_time CHECK ((end_time > start_time)),
    CONSTRAINT out_office_requests_reason_type_check CHECK (((reason_type)::text = ANY ((ARRAY['WORK'::character varying, 'PERSONAL'::character varying])::text[]))),
    CONSTRAINT out_office_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);

-- Bảng push_subscriptions: Đăng ký nhận Web Push.
CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    subscription jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Bảng reminder_dispatches: Lịch sử gửi nhắc việc.
CREATE TABLE public.reminder_dispatches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type character varying(20) NOT NULL,
    request_id uuid NOT NULL,
    reminder_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reminder_dispatches_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['LEAVE'::character varying, 'OUT_OFFICE'::character varying])::text[])))
);

-- Bảng request_change_history: Lịch sử chỉnh sửa hoặc hủy đơn.
CREATE TABLE public.request_change_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type character varying(20) NOT NULL,
    request_id uuid NOT NULL,
    actor_id uuid,
    action character varying(20) NOT NULL,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT request_change_history_action_check CHECK (((action)::text = ANY ((ARRAY['UPDATED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT request_change_history_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['LEAVE'::character varying, 'OUT_OFFICE'::character varying])::text[])))
);

-- Bảng sessions: Phiên đăng nhập của người dùng.
CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Bảng teams: Danh sách team thuộc phòng ban.
CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid,
    name character varying(255) NOT NULL
);

-- Bảng users: Tài khoản, hồ sơ nhân sự và người quản lý trực tiếp.
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_code character varying(50),
    email character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    department_id uuid,
    team_id uuid,
    manager_id uuid,
    "position" character varying(150),
    password_hash character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_data bytea,
    avatar_mime_type character varying(50),
    avatar_updated_at timestamp with time zone,
    employment_status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT users_employment_status_check CHECK (((employment_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'TERMINATED'::character varying])::text[]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['STAFF'::character varying, 'TEAM_LEAD'::character varying, 'MANAGER'::character varying, 'ACCOUNTANT'::character varying, 'ADMIN'::character varying, 'DIRECTOR'::character varying])::text[])))
);

-- DỮ LIỆU KHỞI TẠO: phòng ban.
INSERT INTO public.departments VALUES ('f3ade464-96d4-4da9-989c-1c5fb9f3073e', 'Ban giám đốc');
INSERT INTO public.departments VALUES ('b068da2a-7ee9-49d6-9c0b-26cfeaef8311', 'Kế toán');
INSERT INTO public.departments VALUES ('be7f47b2-d973-4d88-a3fe-f50f79055f8b', 'Dịch vụ');
INSERT INTO public.departments VALUES ('8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', 'Marketing');
INSERT INTO public.departments VALUES ('8f1ff34c-9fe4-49e1-bed1-9a49ecdfd9ce', 'IT');
INSERT INTO public.departments VALUES ('ab12e43a-3104-4cf5-909c-241660cbee66', 'Quản lý');

-- DỮ LIỆU KHỞI TẠO: ngày nghỉ lễ.
INSERT INTO public.holidays VALUES ('99969bd2-2043-43b3-b84c-23645b51d452', 'Tết Dương Lịch', '2026-01-01', '2026-01-01', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07');
INSERT INTO public.holidays VALUES ('43ef7ed2-4e29-46d0-aa68-0a5c964e1bb9', 'Giỗ tổ Hùng Vương', '2026-04-02', '2026-04-02', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07');
INSERT INTO public.holidays VALUES ('f3582f6c-7710-4526-ade3-9453ecf64197', 'Ngày Giải phóng miền Nam', '2026-04-30', '2026-04-30', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07');
INSERT INTO public.holidays VALUES ('342c23dc-8d45-442c-a527-23c0b618f8a4', 'Ngày Quốc tế Lao động', '2026-05-01', '2026-05-01', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07');
INSERT INTO public.holidays VALUES ('c0309fbf-e9ab-441b-aa9d-ed232de2d214', 'Ngày Quốc khánh', '2026-09-02', '2026-09-02', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07');

-- DỮ LIỆU KHỞI TẠO: team.
INSERT INTO public.teams VALUES ('26880b2b-f9f3-4ab9-a17e-e38866a530c0', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', 'Team Lượng');
INSERT INTO public.teams VALUES ('5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', 'Team Long');
INSERT INTO public.teams VALUES ('7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', 'Team Nguyệt');

-- DỮ LIỆU KHỞI TẠO: nhân sự và người quản lý trực tiếp.
INSERT INTO public.users VALUES ('3f947026-fbcc-40e2-bc17-46b9f9e9fbf6', 'NV036', 'luongtv@trithucvietbn.com', 'Trần Văn Lượng', 'TEAM_LEAD', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Team Lead', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9c6c2dda-b40c-4fea-ae5a-e4d95b018ed5', 'NV093', 'longnv@trithucvietbn.com', 'Nguyễn Viết Long', 'TEAM_LEAD', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Team Lead', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9ee31756-8cad-486f-b01a-99d79bd9179a', NULL, 'admin@trithucvietbn.com', 'Quản trị hệ thống', 'ADMIN', NULL, NULL, NULL, 'Quản trị hệ thống', '$2a$10$.a7P.2JzFEy3Bwfj5zmE2ewkSD26QZcPYurykHlZvxD/vP4d3yqo2', true, '2026-10-30 14:28:08.622985+07', '2026-10-30 14:28:08.622985+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('967da0ea-d7ec-41c3-8c14-eaa3d0543889', 'NV101', 'nguyentt@trithucvietbn.com', 'Trương Thị Nguyên', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên truyền thông', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('5e4dc881-3758-4e0b-8f63-288cba0198a5', 'NV056', 'tuannq.nv056@trithucvietbn.com', 'Nguyễn Quang Tuấn 2000', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên edit', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('2c535ce2-1c84-4d9d-b2c4-767f7430887f', 'NV206', 'daoptq@trithucvietbn.com', 'Phạm Thị Quỳnh Dao', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên truyền thông', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('342e5646-0de7-494c-927a-98cf84622175', 'NV058', 'huyenhk@trithucvietbn.com', 'Hoàng Khánh Huyền', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên truyền thông', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a86cf979-9d53-4ac7-835a-608abe4f5999', 'NV232', 'quochdv@trithucvietbn.com', 'Hoàng Doãn Việt Quốc', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên edit', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ba6ab2bf-2630-4d3d-9857-c1682d571f4f', 'NV154', 'huonglt.nv154@trithucvietbn.com', 'Lê Thị Hương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', NULL, 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d0d3b7f8-898c-46e5-aab3-12d6d78799b3', 'NV156', 'minhnc@trithucvietbn.com', 'Nguyễn Công Minh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên edit', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('8176d903-6c00-4893-8e75-68080ce82c52', 'NV117', 'ledtm@trithucvietbn.com', 'Dương Thị Mỹ Lệ', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên truyền thông', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('32a7844b-48e3-4177-8bd9-67b4a302d6ec', 'NV077', 'hoangdt@trithucvietbn.com', 'Đinh Thế Hoàng', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên truyền thông', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('522ed203-117f-4164-a364-e3c52f73f750', 'NV252', 'nhanpt@trithucvietbn.com', 'Phương Thị Nhàn', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b8284910-4d2f-486c-8db6-32f8bab5d83a', 'NV005', 'loanntt@trithucvietbn.com', 'Nguyễn Thị Tường Loan', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('2bb2754f-9f5b-46da-9c57-c8b321cb9d48', 'NV326', 'quynhttm@trithucvietbn.com', 'Trần Thị Mai Quỳnh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d1e2a81c-16a5-4307-8e87-047ede1cdea1', 'NV317', 'hangpt@trithucvietbn.com', 'Phạm Thúy Hằng', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('5408892f-38ba-4361-931c-e677d9b7b0fa', 'NV341', 'hannt@trithucvietbn.com', 'Nguyễn Thị Hân', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b2f80d2e-71cb-4de2-83f7-31462a49b3d8', 'NV294', 'ngocnh@trithucvietbn.com', 'Nguyễn Hồng Ngọc', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('fcb203a7-5dc8-4e07-9601-122c75dd4f2b', 'NV225', 'anhttn@trithucvietbn.com', 'Trần Thị Ngọc Ánh', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('0db6e6d4-9109-4b1f-a48d-7fc1a8a19ca1', 'NV321', 'hoangdm@trithucvietbn.com', 'Đỗ Minh Hoàng', 'STAFF', '8f1ff34c-9fe4-49e1-bed1-9a49ecdfd9ce', NULL, '9f4c6bae-2dd4-4e89-8fb2-01b8c51952b5', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b29cd6a0-f7c4-4013-bd48-2e1cdff3db10', 'NV316', 'tuna@trithucvietbn.com', 'Nguyễn Anh Tú', 'STAFF', '8f1ff34c-9fe4-49e1-bed1-9a49ecdfd9ce', NULL, '9f4c6bae-2dd4-4e89-8fb2-01b8c51952b5', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9f4c6bae-2dd4-4e89-8fb2-01b8c51952b5', 'NV003', 'nghiemnq@trithucvietbn.com', 'Nguyễn Quang Nghiêm', 'DIRECTOR', 'f3ade464-96d4-4da9-989c-1c5fb9f3073e', NULL, '563cdd6d-ae19-4c76-83a7-01c678bf9ff1', 'Giám đốc điều hành', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ab01940d-eb12-43b6-8ce2-51365be6e41c', 'GD002', 'bevth@trithucvietbn.com', 'Vũ Thị Hồng Bé', 'MANAGER', 'f3ade464-96d4-4da9-989c-1c5fb9f3073e', NULL, '563cdd6d-ae19-4c76-83a7-01c678bf9ff1', 'Trưởng phòng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('fd4ac28b-3067-486a-a74b-323c51449b2f', 'NV051', 'chauntm@trithucvietbn.com', 'Nguyễn Thị Minh Châu', 'ACCOUNTANT', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e64476ee-e085-4e4d-b893-955ec8d2a48c', 'NV168', 'thuynt@trithucvietbn.com', 'Ngọc Thị Thúy', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9e48dec8-d86e-44aa-9a56-9eb801327b10', 'NV070', 'phuongvtt@trithucvietbn.com', 'Vũ Thị Thảo Phương', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('03225c33-23cb-4322-ac94-289c0d3a18fb', 'NV028', 'linhnt@trithucvietbn.com', 'Nguyễn Thảo Linh', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Kế toán', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('21a675fd-2e27-4b80-a2d0-48cbf89b6ab8', 'NV007', 'thont@trithucvietbn.com', 'Nguyễn Thị Thơ', 'STAFF', 'b068da2a-7ee9-49d6-9c0b-26cfeaef8311', NULL, 'ab01940d-eb12-43b6-8ce2-51365be6e41c', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('7137a706-76c2-49ac-a261-8ef23c6a56a1', 'NV336', 'toannb@trithucvietbn.com', 'Nguyễn Bá Toản', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên edit', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('71f571b5-516a-43a0-bc1f-85d93d1b4048', 'NV318', 'duynv@trithucvietbn.com', 'Nguyễn Văn Duy', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên edit', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('720005f6-f9bb-4821-b9d0-891992a4dae6', 'NV239', 'thuydt@trithucvietbn.com', 'Đặng Thị Thùy', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('7c3b0e4a-c102-4bb6-8072-0786391f0edc', 'NV214', 'anhptq@trithucvietbn.com', 'Phan Thị Quỳnh Anh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('beadee00-6002-41b1-98a4-14f2206fc208', 'NV299', 'hangttt@trithucvietbn.com', 'Trần Thị Thúy Hằng', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('4a53cbab-09c1-4675-992a-ab42e8ddad6c', 'NV288', 'trangch@trithucvietbn.com', 'Chu Hà Trang', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('cd1d936c-836e-4a3a-90e0-b5c506280757', 'NV161', 'hiennt@trithucvietbn.com', 'Nguyễn Thu Hiền', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c7bc743b-9ed2-4645-9ba3-57806baa93e9', 'NV115', 'yendt@trithucvietbn.com', 'Dương Thị Yến', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a34bd1d7-29d5-475e-bf09-3ce210364fbe', 'NV303', 'huongpt@trithucvietbn.com', 'Phạm Thu Hương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c530f412-b8fb-4941-a1d2-94d1cfe40571', 'NV081', 'phuongltt@trithucvietbn.com', 'Lê Thị Thu Phương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('0bf8785b-7fcd-4d61-afbb-2f8670105a74', 'NV295', 'sinhbt@trithucvietbn.com', 'Bùi Thị Sinh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ed55ddaa-469c-4e84-afe4-18a5814fad8e', 'NV073', 'dongbt@trithucvietbn.com', 'Bàn Thị Đông', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('265d7179-4b8a-4309-8270-0c20b6d7f4c1', 'NV061', 'sault@trithucvietbn.com', 'La Thị Sáu', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b0f8dbca-4cfd-45e5-ab6c-1acf4a16de16', 'NV053', 'nhannt@trithucvietbn.com', 'Nguyễn Thị Nhàn', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('06583b3e-e385-48bb-a871-22dd33573634', 'NV255', 'mybtt@trithucvietbn.com', 'Bàn Thị Trà My', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('6bf9838a-d176-4374-9014-881f05d5b7db', 'NV302', 'thuongttt@trithucvietbn.com', 'Thạch Thị Thương Thương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('088569fe-172b-4b58-a69e-c2e42bef21ed', 'NV049', 'huongttd@trithucvietbn.com', 'Trần Thị Diệu Hương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a7010786-5849-4212-a5e3-3e33a03a3511', 'NV129', 'hant@trithucvietbn.com', 'Nguyễn Thị Hà', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('dededcde-e98f-4306-89ab-091dc579f21c', 'NV048', 'huongnm@trithucvietbn.com', 'Nguyễn Mai Hương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d6e880ab-452c-4ab1-98d4-93f1c7cfde06', 'NV054', 'hanght.nv054@trithucvietbn.com', 'Hoàng Thu Hằng', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ddd9b3fc-18b2-4916-95d6-4c98b6a281b0', 'NV184', 'tuyenlt@trithucvietbn.com', 'Lãnh Thị Tuyến', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c8e60e75-b579-41a5-b90e-2f1d11f8228e', 'NV076', 'thaopt@trithucvietbn.com', 'Phùng Thị Thao', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('38e2be3a-1b53-4c38-bbaa-2b159f2a9bc2', 'NV071', 'thupt@trithucvietbn.com', 'Phạm Thị Thư', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('41fffb9c-b44d-4356-b455-829188e21ccb', 'NV065', 'nhungnth@trithucvietbn.com', 'Nguyễn Thị Hồng Nhung', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e090675f-a685-48e9-b7f1-ceaaef052f16', 'NV289', 'anhmt@trithucvietbn.com', 'Mai Tùng Anh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên edit', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9a5b4838-39c6-4a78-868a-8fa493c63e43', 'NV095', 'nguyetntm@trithucvietbn.com', 'Nguyễn Thị Minh Nguyệt', 'TEAM_LEAD', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Team Lead', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('f55a6cf6-bf39-49a3-9ebe-f9d026dfc9f2', 'NV216', 'hoangnh@trithucvietbn.com', 'Nguyễn Huy Hoàng', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('37507413-52af-442d-87b2-4dde552371e8', 'NV146', 'thaotm@trithucvietbn.com', 'Trần Minh Thao', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('30af0983-4de7-4b4f-9674-af00ef32e7d6', 'NV069', 'tinhtc@trithucvietbn.com', 'Trần Công Tình', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a255c1d8-5ffc-4424-8efb-31910b42a713', 'NV064', 'thangdq@trithucvietbn.com', 'Đỗ Quyết Thắng', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('f1db0237-1933-4157-80f0-96413c542c11', 'NV059', 'daivpq@trithucvietbn.com', 'Võ Phước Quang Đại', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('bf39394f-49bd-4ea7-bfaa-babb7d1967b8', 'NV057', 'vuongnd@trithucvietbn.com', 'Nguyễn Đắc Vương', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('6410ccae-4188-4226-a2a9-4be8b15ded33', 'NV055', 'haind@trithucvietbn.com', 'Nguyễn Đức Hải', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('790f2b9c-0fef-405a-96ce-1b7d42ba8f77', 'NV050', 'huylq@trithucvietbn.com', 'Lương Quốc Huy', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('bcd306a9-3285-407d-a1e9-a56db75503d4', 'NV030', 'ngocnn@trithucvietbn.com', 'Nguyễn Nguyên Ngọc', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('5322e9b0-ea8d-49e9-b0e3-1d45a366369e', 'NV026', 'kiennh@trithucvietbn.com', 'Nguyễn Hữu Kiên', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('65ae8075-36d5-44a5-a814-713a51b7ac76', 'NV025', 'viettq@trithucvietbn.com', 'Trần Quốc Việt', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('33842847-1e6d-4363-bdb6-05d37e9f5138', 'NV021', 'quyenlq@trithucvietbn.com', 'Lê Quang Quyền', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('48ab513c-afa2-41af-bf0c-607e182f1253', 'NV020', 'huanpk@trithucvietbn.com', 'Phạm Khắc Huân', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('dea60fc9-1edf-43aa-97a5-035f4d13f87b', 'NV016', 'quynhlv@trithucvietbn.com', 'Lê Văn Quỳnh', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('02d693bb-0b11-4dcd-b5f4-7f80b2eaed37', 'NV015', 'dunghv@trithucvietbn.com', 'Hà Văn Dũng', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a43f58b8-0cb3-485d-986f-258829d0e7a9', 'NV014', 'thangtv@trithucvietbn.com', 'Trần Văn Thắng', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c241ecc8-5b2d-4c18-9cce-09c160516d62', 'NV012', 'hoangdh@trithucvietbn.com', 'Đặng Hữu Hoàng', 'STAFF', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '8ef025ae-3f00-4dee-8ef6-11306228d685', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ff87cf1d-f9b9-455e-abae-603f8ef92536', 'NV347', 'liemlt@trithucvietbn.com', 'Lô Thị Liệm', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d77f2607-5926-493a-b3ea-5c7465e4095b', 'NV009', 'chinhnt@trithucvietbn.com', 'Nguyễn Thị Chinh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d50a3334-d7f6-4621-9ae9-3e43a0d3a172', 'NV019', 'tiendt@trithucvietbn.com', 'Đỗ Thị Tiến', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('79e9b507-a504-47e5-bb71-e7cc328b634e', 'NV038', 'hauht@trithucvietbn.com', 'Hoàng Thị Hậu', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('75372ef2-b234-4807-8005-db1e60ec2bc0', 'NV039', 'diepnd@trithucvietbn.com', 'Nguyễn Duy Điệp', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên truyền thông', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a40231f2-306c-4327-ac70-a23d72e8cc70', 'NV047', 'thuvtn@trithucvietbn.com', 'Võ Thị Ngọc Thu', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e2461fa8-c49b-47c3-ac33-0a4480935d90', 'NV044', 'phuongnt@trithucvietbn.com', 'Nguyễn Thị Phương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '26880b2b-f9f3-4ab9-a17e-e38866a530c0', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9d98575d-1f1d-467f-9216-b414966f499a', 'NV018', 'hongnt@trithucvietbn.com', 'Nguyễn Thị Hồng', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d7e6c660-5eb1-4c53-91d2-4910536bdf08', 'NV004', 'hochv@trithucvietbn.com', 'Hoàng Văn Học', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b9c57ad0-9fc7-44b6-a750-8b30a5504dc1', 'NV023', 'ngocnt@trithucvietbn.com', 'Nguyễn Thị Ngọc', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '5bff8195-84ce-4290-8ea7-62c8d0ce9c9a', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('6297db5c-675f-42f7-9880-4c9b2788dea5', 'NV045', 'huonglt@trithucvietbn.com', 'Lộc Thị Hương', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d93dbc06-34eb-48b2-b49b-cc6213cf05b6', 'NV041', 'giangvlh@trithucvietbn.com', 'Võ Lê Hà Giang', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('636c7f04-6d78-4fd7-ae96-d536d9716513', 'NV031', 'lieuht@trithucvietbn.com', 'Hà Thị Liễu', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('0092d6a2-2dec-46f5-8772-260e1f5eea37', 'NV008', 'hanght@trithucvietbn.com', 'Hoàng Thị Hằng', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d3ad49f8-9048-4273-b212-476b9b5e10b8', 'NV029', 'anhdtl@trithucvietbn.com', 'Đinh Thị Lan Anh', 'STAFF', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', '7104fa3b-3e1c-4bd5-9e1e-6021e3b75054', 'b2015f95-3799-4170-8b2a-530f9b348df4', 'Nhân viên tuyển dụng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b93aaebc-2f91-4bd4-8809-6b8910f48a3f', 'NV346', 'huongtt@trithucvietbn.com', 'Trần Thị Hương', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('8256dc6a-2cec-4a48-a8e1-5aa0e6c0a796', 'NV345', 'quybt@trithucvietbn.com', 'Bế Thị Quy', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('2ad3558e-2281-4b87-966b-f806b6819c99', 'NV344', 'tamtt@trithucvietbn.com', 'Triệu Thị Tâm', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c124f857-d16c-408f-b6a2-752a07dfec87', 'NV343', 'muonght@trithucvietbn.com', 'Hoàng Thị Mương', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('94008de8-7fff-43a4-bfa1-56cc40234229', 'NV342', 'vienpt@trithucvietbn.com', 'Phạm Thị Viên', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('8fe0e21c-f0a2-4a49-9709-72bb0c41a5b9', 'NV339', 'havtt@trithucvietbn.com', 'Vi Thị Thu Hà', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('8f2e0ce9-aab4-40a7-9751-62b40e2c1787', 'NV338', 'nhinhlt@trithucvietbn.com', 'Lô Thị Nhình', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('6677052a-f294-49d9-9f0a-a38890262637', 'NV337', 'noilt@trithucvietbn.com', 'Lèo Thi Nơi', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a153c37d-96fe-46f1-8ca9-5a12a5da9130', 'NV080', 'thoannt@trithucvietbn.com', 'Nguyễn Thị Thoan', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('362afc87-39b3-4432-96a8-febe65ae2d55', 'NV335', 'huyenlt@trithucvietbn.com', 'Lăng Thị Huyền', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('241b0fa1-dad1-4101-87b3-6a80824f2b47', 'NV333', 'luuht@trithucvietbn.com', 'Hoàng Thị Lưu', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('21e90021-a106-4cc6-8449-7018fbaa2fb0', 'NV332', 'bacpd@trithucvietbn.com', 'Phạm Đình Bắc', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('69830f20-a4f8-4d8c-aa4d-3221798ac082', 'NV331', 'viennt@trithucvietbn.com', 'Nông Thị Viên', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('8be49422-9cb9-45dc-a290-98f93da8851b', 'NV330', 'nhanht@trithucvietbn.com', 'Hoàng Thị Nhàn', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d51b501e-fa72-4ed6-b51d-8b8499845644', 'NV329', 'tuyennv@trithucvietbn.com', 'Nông Văn Tuyển', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9f8ebbf0-0591-4e66-8b53-9f742d873ce5', 'NV325', 'minhntt@trithucvietbn.com', 'Nguyễn Tài Tuệ Minh', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('146def5a-d280-43d6-8f4a-d4f3e247a752', 'NV324', 'vietlt@trithucvietbn.com', 'Lô Thị Viết', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('64e2c314-e4ea-4032-8d3f-fc09bd4780a9', 'NV319', 'longns@trithucvietbn.com', 'Nguyễn Sỹ Long', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('cac51675-7336-4d1c-beb1-d6ac197208eb', 'NV315', 'gianglv@trithucvietbn.com', 'Lê Văn Giang', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c45fbd9e-b371-489f-be47-b24423418526', 'NV311', 'nguyenvv@trithucvietbn.com', 'Vi Văn Nguyện', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('36705c4e-8dbc-4a8e-a146-57fc4fce83cf', 'NV310', 'cuongnp@trithucvietbn.com', 'Nguyễn Phú Cường', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e09c6a0a-50c6-42f6-b511-e6b2eb2daac1', 'NV304', 'giant@trithucvietbn.com', 'Nông Thị Gia', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('27df2da4-42e7-4f65-a2aa-c1b05ce27827', 'NV298', 'nghiant@trithucvietbn.com', 'Nguyễn Thế Nghĩa', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('99413116-fa12-4c1a-9834-c7a7a809ad6d', 'NV290', 'xoannt@trithucvietbn.com', 'Nguyễn Thị Xoan', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9d01ea21-ebe7-44cb-96e4-fc7611737b84', 'NV282', 'chind@trithucvietbn.com', 'Nguyễn Đức Chi', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('34b5da11-9df0-4823-8c4f-4cb3bc1c4d13', 'NV281', 'thanhnp@trithucvietbn.com', 'Nguyễn Phương Thành', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b471d523-af38-43c3-94c6-adf90da2954c', 'NV280', 'tuynd@trithucvietbn.com', 'Nông Đức Tụy', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('89e892d6-ac26-484e-a3c4-963d425ebe6b', 'NV277', 'tuongnt@trithucvietbn.com', 'Nông Thị Tương', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('cbe0310d-585d-494e-a018-57d6b2364caf', 'NV271', 'huonglt.nv271@trithucvietbn.com', 'Lương Thị Hương', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('20fe0997-a230-41f5-bef1-652abad65531', 'NV270', 'loipt@trithucvietbn.com', 'Phạm Thành Lợi', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e901295a-937f-41c3-853d-189e621a9e8b', 'NV264', 'dienmd@trithucvietbn.com', 'Mông Đình Diện', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('fdab8397-4862-49d1-a855-1297410e37a1', 'NV263', 'tandv@trithucvietbn.com', 'Đỗ Văn Tân', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('dd192883-5985-4067-b5d5-34be78e8d98a', 'NV261', 'dept@trithucvietbn.com', 'Phù Thị Đê', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('05137692-2f3b-4862-ba94-5cda7f6a381e', 'NV259', 'taidt@trithucvietbn.com', 'Đinh Trọng Tài', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('1c4aae3d-a520-4ae5-b55d-1aab8ade66cf', 'NV257', 'tiendd@trithucvietbn.com', 'Đào Duy Tiến', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d812bc82-f6e1-4e38-8b43-8b9044ec5e8d', 'NV244', 'huuvv@trithucvietbn.com', 'Vi Văn Hữu', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('fa644725-4ac9-4aac-bdc6-02f0f0cf54d0', 'NV243', 'sonkt@trithucvietbn.com', 'Khúc Thái Sơn', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e8f3a48a-c8ae-4996-87e3-4c18e5cef00f', 'NV241', 'hoant@trithucvietbn.com', 'Nguyễn Thị Họa', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('03ea080c-d36d-486e-96ba-fd3fa9c870c8', 'NV237', 'binhlv@trithucvietbn.com', 'Lê Văn Bình', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('5cc7a724-5e0a-4570-8f2f-2770c72ffe3d', 'NV231', 'thanht@trithucvietbn.com', 'Trần Thanh', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('01af4fe2-b91d-44d7-825b-6bb20e866686', 'NV227', 'cuongnv@trithucvietbn.com', 'Nông Văn Cường', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('dab47702-149b-4a29-8cb8-c64c9fd3ce1b', 'NV219', 'trungtd@trithucvietbn.com', 'Trần Đức Trung', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('2a721df8-92b6-4ae1-b1c1-a76c0fafd0cc', 'NV217', 'lxhvd@trithucvietbn.com', 'Hà Văn Dũng LX', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e22f90d3-5b56-4ee4-aed5-6b0b41e39dd4', 'NV205', 'hainv@trithucvietbn.com', 'Nông Văn Hải', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('71e7f78f-2d94-49ac-aaa3-4095ca33b3a4', 'NV204', 'tuannn@trithucvietbn.com', 'Nguyễn Ngọc Tuấn', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('3f841e8b-5622-4f15-a12e-611db548017b', 'NV197', 'maott@trithucvietbn.com', 'Trần Thị Mão', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9dcd36f0-671a-4d6e-8a14-1d2321557898', 'NV181', 'gamlh@trithucvietbn.com', 'Lê Hồng Gấm', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('69830bad-9f59-459c-8bdd-7dac510a89d3', 'NV177', 'quyetnv@trithucvietbn.com', 'Nguyễn Văn Quyết', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b489489e-f255-477f-bb4f-b2f0a70a1c8f', 'NV178', 'thaonp@trithucvietbn.com', 'Nguyễn Phương Thảo', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('7927cc33-aa31-465a-8553-3dce5fabd59a', 'NV170', 'binhnt@trithucvietbn.com', 'Nguyễn Thanh Bình', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('4389e33a-b758-47de-88c8-8d7cf811028f', 'NV171', 'thaond@trithucvietbn.com', 'Nguyễn Đức Thạo', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ebfe31d2-8af5-4993-8bbd-c1b43468c085', 'NV162', 'thuyvt@trithucvietbn.com', 'Vi Thị Thùy', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('ca429a93-4e5d-4984-9056-2a9b9eefb4f2', 'NV151', 'giangdd@trithucvietbn.com', 'Dương Đăng Giang', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9a2c9b0a-0370-4759-bee2-342ba35d5f60', 'NV148', 'thanhnm@trithucvietbn.com', 'Nguyễn Mạnh Thành', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('66407127-d608-4375-a7a7-a7a3b6e3d75c', 'NV138', 'phanlt@trithucvietbn.com', 'Lê Thị Phận', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('186f057a-a805-43ea-b3c0-8772d874b05a', 'NV132', 'hiepvv@trithucvietbn.com', 'Vũ Văn Hiệp', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a3bd50ce-4474-4472-bd2e-f716a054419b', 'NV131', 'namnv@trithucvietbn.com', 'Nguyễn Vũ Nam', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('a953a4bd-d738-4ce3-815b-ea7880e0d026', 'NV126', 'namnt@trithucvietbn.com', 'Nguyễn Thái Nam', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Bảo vệ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('3670fdaf-5324-4f82-bf36-6d826b0fd8b2', 'NV122', 'thailt@trithucvietbn.com', 'Lê Thị Thái', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('6c71645e-0f80-4267-a699-59b1ba08bdab', 'NV118', 'cotlt@trithucvietbn.com', 'Lù Thị Cọt', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('210e1fa9-274b-4e6d-82bb-6695c437be7d', 'NV107', 'hientv@trithucvietbn.com', 'Trương Văn Hiền', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('66e3d88e-820e-4ea3-bd06-2a5a5f138101', 'NV102', 'quanlv@trithucvietbn.com', 'Lục Văn Quân', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('5a080211-6ff6-4f11-8f91-653e29b08bd7', 'NV090', 'ductt@trithucvietbn.com', 'Triệu Thị Đức', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('dafc3fdf-1563-42cb-96e5-21a91e112b47', 'NV088', 'quynt@trithucvietbn.com', 'Nguyễn Thị Quý', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('4c69e297-d2e8-4dcc-8595-4f55093f7c41', 'NV086', 'tult@trithucvietbn.com', 'Lương Tuấn Tú', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('61ea8fe9-c28d-444c-984b-e21849691cb1', 'NV085', 'thaodv@trithucvietbn.com', 'Đỗ Văn Thảo', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('f12a79e5-6b3c-4c21-b932-737b34149bbc', 'NV067', 'nheont@trithucvietbn.com', 'Nông Thị Nheo', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('78e6b8d8-f2fd-4a51-a2e0-190267c8d8b4', 'NV062', 'hongnc@trithucvietbn.com', 'Nguyễn Công Hồng', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('074166b6-ffba-44f4-95a3-5d86b22b32be', 'NV157', 'ngabtt@trithucvietbn.com', 'Bùi Thị Thúy Nga', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('19a47ac6-4b4f-4464-84ca-1a1a24b9a824', 'NV052', 'huancc@trithucvietbn.com', 'Cung Cường Huân', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('c1a7ddb4-1afd-43f7-aa80-fef80fe3d4e6', 'NV046', 'duonglt@trithucvietbn.com', 'Lê Trùng Dương', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('bfa2866d-f8d4-4193-b028-5eb2ffb34d18', 'NV040', 'khiemnh@trithucvietbn.com', 'Nguyễn Hữu Khiêm', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('95ca450e-6185-4373-ba7e-265e3cc4868d', 'NV035', 'cuclt@trithucvietbn.com', 'Lâm Thị Cúc', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('d9d31aff-50ee-4272-a63f-e096be4c68ac', 'NV034', 'hoanmt@trithucvietbn.com', 'Mai Thị Hoàn', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lễ tân', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('9fcbfb84-71bf-4590-ac94-77b2db011454', 'NV033', 'tuannq@trithucvietbn.com', 'Nguyễn Quang Tuấn', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('41723fbf-4fab-4767-b9a8-539fc988f492', 'NV032', 'thaoht@trithucvietbn.com', 'Hoàng Thị Thao', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Tạp vụ', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('51abb667-435e-4bf0-aa66-0c8e784cf492', 'NV022', 'duclv@trithucvietbn.com', 'Lục Văn Đức', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('e745cf01-69ec-4e88-a4d1-4a38f38c46e2', 'NV017', 'sampv@trithucvietbn.com', 'Phan Văn Sâm', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Lái xe', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('bac08f7b-21be-4b08-9a87-3e48a2f2d2f4', 'NV011', 'giangnq@trithucvietbn.com', 'Nguyễn Quang Giang', 'STAFF', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, 'eb435108-265b-46cf-9ef2-aeb4f38196df', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('563cdd6d-ae19-4c76-83a7-01c678bf9ff1', 'GD001', 'ninhnq@trithucvietbn.com', 'Nguyễn Quang Ninh', 'DIRECTOR', 'f3ade464-96d4-4da9-989c-1c5fb9f3073e', NULL, NULL, 'Giám đốc', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('eb435108-265b-46cf-9ef2-aeb4f38196df', 'NV068', 'thudd@trithucvietbn.com', 'Đỗ Đình Thư', 'MANAGER', 'be7f47b2-d973-4d88-a3fe-f50f79055f8b', NULL, '9f4c6bae-2dd4-4e89-8fb2-01b8c51952b5', 'Trưởng phòng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('b2015f95-3799-4170-8b2a-530f9b348df4', 'NV010', 'cuongdt@trithucvietbn.com', 'Đặng Tuấn Cương', 'MANAGER', '8b48dddf-a2d5-4b1e-8ac7-18c3f1e8411f', NULL, '9f4c6bae-2dd4-4e89-8fb2-01b8c51952b5', 'Trưởng phòng', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');
INSERT INTO public.users VALUES ('8ef025ae-3f00-4dee-8ef6-11306228d685', 'NV037', 'ducnt@trithucvietbn.com', 'Nguyễn Trọng Đức', 'MANAGER', 'ab12e43a-3104-4cf5-909c-241660cbee66', NULL, '9f4c6bae-2dd4-4e89-8fb2-01b8c51952b5', 'Nhân viên', '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', true, '2026-10-26 18:46:45.498618+07', '2026-10-26 18:46:45.498618+07', NULL, NULL, NULL, 'ACTIVE');

-- Nhóm constraint và khóa ngoại của bảng approval_history.
ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng audit_logs.
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng departments.
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng holidays.
ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_unique UNIQUE (name, start_date, end_date);

-- Nhóm constraint và khóa ngoại của bảng leave_entitlements.
ALTER TABLE ONLY public.leave_entitlements
    ADD CONSTRAINT leave_entitlements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leave_entitlements
    ADD CONSTRAINT leave_entitlements_user_id_leave_year_key UNIQUE (user_id, leave_year);

-- Nhóm constraint và khóa ngoại của bảng leave_requests.
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng login_rate_limits.
ALTER TABLE ONLY public.login_rate_limits
    ADD CONSTRAINT login_rate_limits_pkey PRIMARY KEY (rate_key);

-- Nhóm constraint và khóa ngoại của bảng notifications.
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng out_office_requests.
ALTER TABLE ONLY public.out_office_requests
    ADD CONSTRAINT out_office_requests_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng push_subscriptions.
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng reminder_dispatches.
ALTER TABLE ONLY public.reminder_dispatches
    ADD CONSTRAINT reminder_dispatches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reminder_dispatches
    ADD CONSTRAINT reminder_dispatches_request_type_request_id_reminder_date_key UNIQUE (request_type, request_id, reminder_date);

-- Nhóm constraint và khóa ngoại của bảng request_change_history.
ALTER TABLE ONLY public.request_change_history
    ADD CONSTRAINT request_change_history_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng sessions.
ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng teams.
ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);

-- Nhóm constraint và khóa ngoại của bảng users.
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_code_unique UNIQUE (employee_code);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- Nhóm index của bảng approval_history: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_approval_history_request ON public.approval_history USING btree (request_id);

-- Nhóm index của bảng audit_logs: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);

-- Nhóm index của bảng holidays: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_holidays_dates ON public.holidays USING btree (start_date, end_date) WHERE (is_active = true);

-- Nhóm index của bảng leave_entitlements: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_leave_entitlements_year_user ON public.leave_entitlements USING btree (leave_year, user_id);

-- Nhóm index của bảng leave_requests: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_leave_requests_day_part ON public.leave_requests USING btree (start_date, end_date, day_part);

CREATE INDEX idx_leave_requests_employee_created ON public.leave_requests USING btree (employee_id, created_at DESC);

CREATE INDEX idx_leave_requests_employee_status ON public.leave_requests USING btree (employee_id, status);

CREATE INDEX idx_leave_requests_status_created ON public.leave_requests USING btree (status, created_at);

-- Nhóm index của bảng login_rate_limits: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_login_rate_limits_window ON public.login_rate_limits USING btree (window_started_at);

-- Nhóm index của bảng notifications: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read_at, created_at DESC);

-- Nhóm index của bảng out_office_requests: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_out_office_employee_created ON public.out_office_requests USING btree (employee_id, created_at DESC);

CREATE INDEX idx_out_office_employee_status ON public.out_office_requests USING btree (employee_id, status);

CREATE INDEX idx_out_office_status_schedule ON public.out_office_requests USING btree (status, request_date, start_time);

-- Nhóm index của bảng push_subscriptions: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);

-- Nhóm index của bảng request_change_history: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_request_change_history_request ON public.request_change_history USING btree (request_type, request_id, created_at);

-- Nhóm index của bảng sessions: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

-- Nhóm index của bảng users: phục vụ các truy vấn tra cứu và lọc dữ liệu.
CREATE INDEX idx_users_department_role_active ON public.users USING btree (department_id, role, is_active);

CREATE INDEX idx_users_employment_status ON public.users USING btree (employment_status);

CREATE INDEX idx_users_team_active ON public.users USING btree (team_id, is_active);

-- Nhóm constraint và khóa ngoại của bảng approval_history.
ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);

-- Nhóm constraint và khóa ngoại của bảng audit_logs.
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Nhóm constraint và khóa ngoại của bảng leave_entitlements.
ALTER TABLE ONLY public.leave_entitlements
    ADD CONSTRAINT leave_entitlements_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leave_entitlements
    ADD CONSTRAINT leave_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Nhóm constraint và khóa ngoại của bảng leave_requests.
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_replacement_user_id_fkey FOREIGN KEY (replacement_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Nhóm constraint và khóa ngoại của bảng notifications.
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Nhóm constraint và khóa ngoại của bảng out_office_requests.
ALTER TABLE ONLY public.out_office_requests
    ADD CONSTRAINT out_office_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.out_office_requests
    ADD CONSTRAINT out_office_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Nhóm constraint và khóa ngoại của bảng push_subscriptions.
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Nhóm constraint và khóa ngoại của bảng request_change_history.
ALTER TABLE ONLY public.request_change_history
    ADD CONSTRAINT request_change_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Nhóm constraint và khóa ngoại của bảng sessions.
ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Nhóm constraint và khóa ngoại của bảng teams.
ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- Nhóm constraint và khóa ngoại của bảng users.
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

COMMIT;

SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM public.departments
UNION ALL SELECT 'teams', COUNT(*) FROM public.teams
UNION ALL SELECT 'users', COUNT(*) FROM public.users
UNION ALL SELECT 'holidays', COUNT(*) FROM public.holidays
UNION ALL SELECT 'leave_requests', COUNT(*) FROM public.leave_requests
UNION ALL SELECT 'out_office_requests', COUNT(*) FROM public.out_office_requests
UNION ALL SELECT 'leave_entitlements', COUNT(*) FROM public.leave_entitlements
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
ORDER BY table_name;

SELECT employee_code, full_name, email, role, department_id, team_id, manager_id, employment_status
FROM public.users
ORDER BY employee_code NULLS LAST, full_name;
