-- Import danh sách nhân viên T10/2026 (168 dòng)
-- Nguồn: Danh sách nhân viên T10.2026.xlsx
-- Mật khẩu khởi tạo chung: trithucviet (bcrypt cost 10, phù hợp lib/auth/password.ts).
-- Đổi mật khẩu riêng sau khi cấp tài khoản; bản app hiện chưa ép đổi mật khẩu tự động.
-- Email: tên cuối + chữ cái đầu các phần trước, @trithucvietbn.com.
-- 3 địa chỉ trùng tên được phân biệt bằng .<mã nhân sự> trước @.
-- Không chạy trực tiếp nếu bước kiểm tra UUID đầu tiên thất bại.

BEGIN;

DO $$
DECLARE id_type text; dept_type text;
BEGIN
  SELECT data_type INTO id_type FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'id';
  SELECT data_type INTO dept_type FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'department_id';
  IF id_type IS DISTINCT FROM 'uuid' OR dept_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'Schema không khớp app hiện tại: users.id và users.department_id phải là UUID (phát hiện id=%, department_id=%). Dừng import, không thay đổi dữ liệu.', id_type, dept_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='password_hash') THEN
    RAISE EXCEPTION 'Thiếu users.password_hash. Hãy áp dụng migrations/02_auth_and_extensions.sql trước.';
  END IF;
END $$;

-- Các trường nhân sự có trong Excel nhưng chưa có trong schema khởi tạo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
CREATE UNIQUE INDEX IF NOT EXISTS users_employee_code_uidx ON users(employee_code) WHERE employee_code IS NOT NULL;

-- Tạo phòng ban còn thiếu, tra cứu theo tên; không cần biết UUID.
WITH src(name) AS (VALUES
    ('Ban giám đốc'),
    ('Quản lý chung'),
    ('Tuyển dụng'),
    ('Kế toán'),
    ('Dịch vụ'),
    ('Quản lý'),
    ('Truyền thông'),
    ('IT')
)
INSERT INTO departments(name)
SELECT s.name FROM src s
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE lower(trim(d.name))=lower(trim(s.name)));

-- Phạm vi dữ liệu dựa trên department_id; dừng nếu tên phòng bị trùng.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM departments
    GROUP BY lower(trim(name))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Có phòng ban trùng tên (không phân biệt hoa thường/khoảng trắng). Hãy hợp nhất trước khi import để tránh gán sai department_id.';
  END IF;
END $$;

-- Dữ liệu staging: mã, tên, email, role, phòng, chức danh, ngày vào, mã quản lý.
WITH src(employee_code, full_name, email, role, department_name, position, hire_date, manager_code) AS (VALUES
    ('GD001', 'Nguyễn Quang Ninh', 'ninhnq@trithucvietbn.com', 'DIRECTOR', 'Ban giám đốc', 'Giám đốc', '2009-11-03', NULL),
    ('GD002', 'Vũ Thị Hồng Bé', 'bevth@trithucvietbn.com', 'MANAGER', 'Ban giám đốc', 'Trưởng bộ phận', '2009-11-03', 'GD001'),
    ('NV003', 'Nguyễn Quang Nghiêm', 'nghiemnq@trithucvietbn.com', 'MANAGER', 'Quản lý chung', 'Trưởng bộ phận', '2013-11-01', 'GD001'),
    ('NV004', 'Hoàng Văn Học', 'hochv@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2014-03-09', 'NV010'),
    ('NV005', 'Nguyễn Thị Tường Loan', 'loanntt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2015-12-18', 'NV010'),
    ('NV007', 'Nguyễn Thị Thơ', 'thont@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2016-11-08', 'GD002'),
    ('NV008', 'Hoàng Thị Hằng', 'hanght@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2017-03-19', 'NV010'),
    ('NV009', 'Nguyễn Thị Chinh', 'chinhnt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2017-04-01', 'NV010'),
    ('NV010', 'Đặng Tuấn Cương', 'cuongdt@trithucvietbn.com', 'MANAGER', 'Tuyển dụng', 'Trưởng bộ phận', '2017-05-04', NULL),
    ('NV011', 'Nguyễn Quang Giang', 'giangnq@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2017-10-25', 'NV068'),
    ('NV012', 'Đặng Hữu Hoàng', 'hoangdh@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2018-06-11', 'NV037'),
    ('NV014', 'Trần Văn Thắng', 'thangtv@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2018-08-27', 'NV037'),
    ('NV015', 'Hà Văn Dũng', 'dunghv@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2018-12-01', 'NV037'),
    ('NV016', 'Lê Văn Quỳnh', 'quynhlv@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2019-03-18', 'NV037'),
    ('NV017', 'Phan Văn Sâm', 'sampv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2019-10-23', 'NV068'),
    ('NV018', 'Nguyễn Thị Hồng', 'hongnt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2020-03-23', 'NV010'),
    ('NV019', 'Đỗ Thị Tiến', 'tiendt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2020-06-09', 'NV010'),
    ('NV020', 'Phạm Khắc Huân', 'huanpk@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2020-06-29', 'NV037'),
    ('NV021', 'Lê Quang Quyền', 'quyenlq@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2020-09-01', 'NV037'),
    ('NV022', 'Lục Văn Đức', 'duclv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2020-12-22', 'NV068'),
    ('NV023', 'Nguyễn Thị Ngọc', 'ngocnt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2021-03-08', 'NV010'),
    ('NV025', 'Trần Quốc Việt', 'viettq@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2021-08-25', 'NV037'),
    ('NV026', 'Nguyễn Hữu Kiên', 'kiennh@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2021-09-03', 'NV037'),
    ('NV028', 'Nguyễn Thảo Linh', 'linhnt@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2021-11-03', 'GD002'),
    ('NV029', 'Đinh Thị Lan Anh', 'anhdtl@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2021-11-03', 'NV010'),
    ('NV030', 'Nguyễn Nguyên Ngọc', 'ngocnn@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2021-12-03', 'NV037'),
    ('NV031', 'Hà Thị Liễu', 'lieuht@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2022-03-26', 'NV010'),
    ('NV032', 'Hoàng Thị Thao', 'thaoht@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2022-04-06', 'NV068'),
    ('NV033', 'Nguyễn Quang Tuấn', 'tuannq@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2022-04-12', 'NV068'),
    ('NV034', 'Mai Thị Hoàn', 'hoanmt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2022-05-05', 'NV068'),
    ('NV035', 'Lâm Thị Cúc', 'cuclt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2022-06-02', 'NV068'),
    ('NV036', 'Trần Văn Lượng', 'luongtv@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2022-07-25', 'NV010'),
    ('NV037', 'Nguyễn Trọng Đức', 'ducnt@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2022-08-15', NULL),
    ('NV038', 'Hoàng Thị Hậu', 'hauht@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2022-11-26', 'NV010'),
    ('NV039', 'Nguyễn Duy Điệp', 'diepnd@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2023-03-09', 'NV010'),
    ('NV040', 'Nguyễn Hữu Khiêm', 'khiemnh@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2023-03-13', 'NV068'),
    ('NV041', 'Võ Lê Hà Giang', 'giangvlh@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2023-06-28', 'NV010'),
    ('NV044', 'Nguyễn Thị Phương', 'phuongnt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2023-07-26', 'NV010'),
    ('NV045', 'Lộc Thị Hương', 'huonglt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2023-07-29', 'NV010'),
    ('NV046', 'Lê Trùng Dương', 'duonglt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2023-09-10', 'NV068'),
    ('NV047', 'Võ Thị Ngọc Thu', 'thuvtn@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2023-09-26', 'NV010'),
    ('NV048', 'Nguyễn Mai Hương', 'huongnm@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2023-10-23', 'NV010'),
    ('NV049', 'Trần Thị Diệu Hương', 'huongttd@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2023-12-08', 'NV010'),
    ('NV050', 'Lương Quốc Huy', 'huylq@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2024-01-03', 'NV037'),
    ('NV051', 'Nguyễn Thị Minh Châu', 'chauntm@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2024-03-04', 'GD002'),
    ('NV052', 'Cung Cường Huân', 'huancc@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2024-03-18', 'NV068'),
    ('NV053', 'Nguyễn Thị Nhàn', 'nhannt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-03-21', 'NV010'),
    ('NV054', 'Hoàng Thu Hằng', 'hanght.nv054@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-03-23', 'NV010'),
    ('NV055', 'Nguyễn Đức Hải', 'haind@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2024-03-23', 'NV037'),
    ('NV056', 'Nguyễn Quang Tuấn 2000', 'tuannq.nv056@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2024-03-27', 'NV010'),
    ('NV057', 'Nguyễn Đắc Vương', 'vuongnd@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2024-04-11', 'NV037'),
    ('NV058', 'Hoàng Khánh Huyền', 'huyenhk@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2024-04-15', 'NV010'),
    ('NV059', 'Võ Phước Quang Đại', 'daivpq@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2024-04-15', 'NV037'),
    ('NV061', 'La Thị Sáu', 'sault@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-05-06', 'NV010'),
    ('NV062', 'Nguyễn Công Hồng', 'hongnc@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2024-05-17', 'NV068'),
    ('NV064', 'Đỗ Quyết Thắng', 'thangdq@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2024-06-03', 'NV037'),
    ('NV065', 'Nguyễn Thị Hồng Nhung', 'nhungnth@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-06-03', 'NV010'),
    ('NV067', 'Nông Thị Nheo', 'nheont@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2024-06-24', 'NV068'),
    ('NV068', 'Đỗ Đình Thư', 'thudd@trithucvietbn.com', 'MANAGER', 'Dịch vụ', 'Trưởng bộ phận', '2024-07-01', NULL),
    ('NV069', 'Trần Công Tình', 'tinhtc@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2024-07-03', 'NV037'),
    ('NV070', 'Vũ Thị Thảo Phương', 'phuongvtt@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2024-07-19', 'GD002'),
    ('NV071', 'Phạm Thị Thư', 'thupt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-08-02', 'NV010'),
    ('NV073', 'Bàn Thị Đông', 'dongbt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-08-13', 'NV010'),
    ('NV076', 'Phùng Thị Thao', 'thaopt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-09-05', 'NV010'),
    ('NV077', 'Đinh Thế Hoàng', 'hoangdt@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2024-09-07', 'NV010'),
    ('NV081', 'Lê Thị Thu Phương', 'phuongltt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2024-09-24', 'NV010'),
    ('NV085', 'Đỗ Văn Thảo', 'thaodv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2024-11-01', 'NV068'),
    ('NV086', 'Lương Tuấn Tú', 'tult@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2024-11-06', 'NV068'),
    ('NV088', 'Nguyễn Thị Quý', 'quynt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2024-11-16', 'NV068'),
    ('NV090', 'Triệu Thị Đức', 'ductt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2024-12-25', 'NV068'),
    ('NV093', 'Nguyễn Viết Long', 'longnv@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2025-01-06', 'NV010'),
    ('NV095', 'Nguyễn Thị Minh Nguyệt', 'nguyetntm@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2025-01-13', 'NV010'),
    ('NV101', 'Trương Thị Nguyên', 'nguyentt@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2025-02-17', 'NV010'),
    ('NV102', 'Lục Văn Quân', 'quanlv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2025-02-17', 'NV068'),
    ('NV107', 'Trương Văn Hiền', 'hientv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2025-03-06', 'NV068'),
    ('NV115', 'Dương Thị Yến', 'yendt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2025-04-21', 'NV010'),
    ('NV117', 'Dương Thị Mỹ Lệ', 'ledtm@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2025-05-05', 'NV010'),
    ('NV118', 'Lù Thị Cọt', 'cotlt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2025-05-06', 'NV068'),
    ('NV122', 'Lê Thị Thái', 'thailt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2025-05-19', 'NV068'),
    ('NV126', 'Nguyễn Thái Nam', 'namnt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2025-06-12', 'NV068'),
    ('NV129', 'Nguyễn Thị Hà', 'hant@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2025-06-17', 'NV010'),
    ('NV131', 'Nguyễn Vũ Nam', 'namnv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2025-06-26', 'NV068'),
    ('NV132', 'Vũ Văn Hiệp', 'hiepvv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2025-06-30', 'NV068'),
    ('NV138', 'Lê Thị Phận', 'phanlt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2025-07-12', 'NV068'),
    ('NV146', 'Trần Minh Thao', 'thaotm@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2025-08-01', 'NV037'),
    ('NV148', 'Nguyễn Mạnh Thành', 'thanhnm@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2025-08-01', 'NV068'),
    ('NV151', 'Dương Đăng Giang', 'giangdd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2025-08-06', 'NV068'),
    ('NV154', 'Lê Thị Hương', 'huonglt.nv154@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2025-08-11', 'NV010'),
    ('NV156', 'Nguyễn Công Minh', 'minhnc@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2025-08-11', 'NV010'),
    ('NV157', 'Bùi Thị Thúy Nga', 'ngabtt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2025-08-19', 'NV068'),
    ('NV161', 'Nguyễn Thu Hiền', 'hiennt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2025-08-25', 'NV010'),
    ('NV162', 'Vi Thị Thùy', 'thuyvt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2025-08-26', 'NV068'),
    ('NV168', 'Ngọc Thị Thúy', 'thuynt@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2025-09-16', 'GD002'),
    ('NV171', 'Nguyễn Đức Thạo', 'thaond@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2025-09-27', 'NV068'),
    ('NV170', 'Nguyễn Thanh Bình', 'binhnt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2025-09-25', 'NV068'),
    ('NV178', 'Nguyễn Phương Thảo', 'thaonp@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2025-10-22', 'NV068'),
    ('NV177', 'Nguyễn Văn Quyết', 'quyetnv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2025-10-20', 'NV068'),
    ('NV181', 'Lê Hồng Gấm', 'gamlh@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2025-11-05', 'NV068'),
    ('NV184', 'Lãnh Thị Tuyến', 'tuyenlt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2025-11-10', 'NV010'),
    ('NV197', 'Trần Thị Mão', 'maott@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-01-02', 'NV068'),
    ('NV204', 'Nguyễn Ngọc Tuấn', 'tuannn@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-01-23', 'NV068'),
    ('NV205', 'Nông Văn Hải', 'hainv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-02-01', 'NV068'),
    ('NV206', 'Phạm Thị Quỳnh Dao', 'daoptq@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2026-02-26', 'NV010'),
    ('NV214', 'Phan Thị Quỳnh Anh', 'anhptq@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-03-02', 'NV010'),
    ('NV216', 'Nguyễn Huy Hoàng', 'hoangnh@trithucvietbn.com', 'STAFF', 'Quản lý', 'Nhân viên', '2026-03-02', 'NV037'),
    ('NV217', 'Hà Văn Dũng LX', 'lxhvd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-03-02', 'NV068'),
    ('NV219', 'Trần Đức Trung', 'trungtd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-03-02', 'NV068'),
    ('NV225', 'Trần Thị Ngọc Ánh', 'anhttn@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2026-03-09', 'GD002'),
    ('NV227', 'Nông Văn Cường', 'cuongnv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-03-10', 'NV068'),
    ('NV231', 'Trần Thanh', 'thanht@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2026-03-20', 'NV068'),
    ('NV232', 'Hoàng Doãn Việt Quốc', 'quochdv@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2026-03-23', 'NV010'),
    ('NV237', 'Lê Văn Bình', 'binhlv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-04-20', 'NV068'),
    ('NV239', 'Đặng Thị Thùy', 'thuydt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-05-08', 'NV010'),
    ('NV241', 'Nguyễn Thị Họa', 'hoant@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-05-11', 'NV068'),
    ('NV243', 'Khúc Thái Sơn', 'sonkt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2026-05-13', 'NV068'),
    ('NV244', 'Vi Văn Hữu', 'huuvv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-05-14', 'NV068'),
    ('NV252', 'Phương Thị Nhàn', 'nhanpt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2026-05-25', 'NV068'),
    ('NV255', 'Bàn Thị Trà My', 'mybtt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-05-26', 'NV010'),
    ('NV257', 'Đào Duy Tiến', 'tiendd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-06-03', 'NV068'),
    ('NV259', 'Đinh Trọng Tài', 'taidt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-06-05', 'NV068'),
    ('NV261', 'Phù Thị Đê', 'dept@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2026-06-08', 'NV068'),
    ('NV263', 'Đỗ Văn Tân', 'tandv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2026-06-09', 'NV068'),
    ('NV264', 'Mông Đình Diện', 'dienmd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2026-06-09', 'NV068'),
    ('NV270', 'Phạm Thành Lợi', 'loipt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-06-18', 'NV068'),
    ('NV271', 'Lương Thị Hương', 'huonglt.nv271@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2026-06-18', 'NV068'),
    ('NV277', 'Nông Thị Tương', 'tuongnt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-06-26', 'NV068'),
    ('NV280', 'Nông Đức Tụy', 'tuynd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2026-07-01', 'NV068'),
    ('NV281', 'Nguyễn Phương Thành', 'thanhnp@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-07-01', 'NV068'),
    ('NV282', 'Nguyễn Đức Chi', 'chind@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2026-07-03', 'NV068'),
    ('NV288', 'Chu Hà Trang', 'trangch@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-07-07', 'NV010'),
    ('NV289', 'Mai Tùng Anh', 'anhmt@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2026-07-07', 'NV010'),
    ('NV290', 'Nguyễn Thị Xoan', 'xoannt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-07-12', 'NV068'),
    ('NV294', 'Nguyễn Hồng Ngọc', 'ngocnh@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2026-07-13', 'GD002'),
    ('NV295', 'Bùi Thị Sinh', 'sinhbt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-07-14', 'NV010'),
    ('NV298', 'Nguyễn Thế Nghĩa', 'nghiant@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Bảo vệ', '2026-07-15', 'NV068'),
    ('NV299', 'Trần Thị Thúy Hằng', 'hangttt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-07-17', 'NV010'),
    ('NV302', 'Thạch Thị Thương Thương', 'thuongttt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-07-21', 'NV010'),
    ('NV303', 'Phạm Thu Hương', 'huongpt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-07-21', 'NV010'),
    ('NV304', 'Nông Thị Gia', 'giant@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-07-25', 'NV068'),
    ('NV310', 'Nguyễn Phú Cường', 'cuongnp@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-08-11', 'NV068'),
    ('NV311', 'Vi Văn Nguyện', 'nguyenvv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-08-12', 'NV068'),
    ('NV315', 'Lê Văn Giang', 'gianglv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-08-14', 'NV068'),
    ('NV316', 'Nguyễn Anh Tú', 'tuna@trithucvietbn.com', 'STAFF', 'IT', 'Nhân viên', '2026-08-24', 'NV003'),
    ('NV317', 'Phạm Thúy Hằng', 'hangpt@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-08-24', 'NV010'),
    ('NV318', 'Nguyễn Văn Duy', 'duynv@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2026-08-24', 'NV010'),
    ('NV319', 'Nguyễn Sỹ Long', 'longns@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-08-26', 'NV068'),
    ('NV321', 'Đỗ Minh Hoàng', 'hoangdm@trithucvietbn.com', 'STAFF', 'IT', 'Nhân viên', '2026-09-03', 'NV003'),
    ('NV324', 'Lô Thị Viết', 'vietlt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-05', 'NV068'),
    ('NV325', 'Nguyễn Tài Tuệ Minh', 'minhntt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2026-09-06', 'NV068'),
    ('NV326', 'Trần Thị Mai Quỳnh', 'quynhttm@trithucvietbn.com', 'STAFF', 'Tuyển dụng', 'Nhân viên', '2026-09-07', 'NV010'),
    ('NV329', 'Nông Văn Tuyển', 'tuyennv@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lái xe', '2026-09-08', 'NV068'),
    ('NV330', 'Hoàng Thị Nhàn', 'nhanht@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-09', 'NV068'),
    ('NV331', 'Nông Thị Viên', 'viennt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-12', 'NV068'),
    ('NV332', 'Phạm Đình Bắc', 'bacpd@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Nhân viên', '2026-09-15', 'NV068'),
    ('NV333', 'Hoàng Thị Lưu', 'luuht@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Lễ tân', '2026-09-17', 'NV068'),
    ('NV335', 'Lăng Thị Huyền', 'huyenlt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-19', 'NV068'),
    ('NV080', 'Nguyễn Thị Thoan', 'thoannt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-19', 'NV068'),
    ('NV336', 'Nguyễn Bá Toản', 'toannb@trithucvietbn.com', 'STAFF', 'Truyền thông', 'Nhân viên', '2026-09-21', 'NV010'),
    ('NV337', 'Lèo Thi Nơi', 'noilt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-25', 'NV068'),
    ('NV338', 'Lô Thị Nhình', 'nhinhlt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-30', 'NV068'),
    ('NV339', 'Vi Thị Thu Hà', 'havtt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-09-30', 'NV068'),
    ('NV341', 'Nguyễn Thị Hân', 'hannt@trithucvietbn.com', 'STAFF', 'Kế toán', 'Nhân viên', '2026-10-06', 'GD002'),
    ('NV342', 'Phạm Thị Viên', 'vienpt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-10-06', 'NV068'),
    ('NV343', 'Hoàng Thị Mương', 'muonght@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-10-14', 'NV068'),
    ('NV344', 'Triệu Thị Tâm', 'tamtt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-10-17', 'NV068'),
    ('NV345', 'Bế Thị Quy', 'quybt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-10-17', 'NV068'),
    ('NV346', 'Trần Thị Hương', 'huongtt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-10-20', 'NV068'),
    ('NV347', 'Lô Thị Liệm', 'liemlt@trithucvietbn.com', 'STAFF', 'Dịch vụ', 'Tạp vụ', '2026-10-20', 'NV068')
), mapped AS (
  SELECT s.*, d.id AS department_id
  FROM src s
  JOIN LATERAL (
    SELECT id FROM departments d
    WHERE lower(trim(d.name))=lower(trim(s.department_name))
    ORDER BY id LIMIT 1
  ) d ON true
)
INSERT INTO users (employee_code, full_name, email, role, department_id, position, hire_date, password_hash, is_active)
SELECT m.employee_code, m.full_name, m.email, m.role, m.department_id, m.position, m.hire_date,
       '$2a$10$dnXgqaUZShydX10zn4LW/.f2ZWPx3i31GgGtXCPG9PlpbqSlgwy8m', TRUE
FROM mapped m
ON CONFLICT (email) DO UPDATE SET
  employee_code = EXCLUDED.employee_code,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  position = EXCLUDED.position,
  hire_date = EXCLUDED.hire_date,
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE,
  updated_at = NOW();

-- Liên kết quản lý bằng employee_code, không cần tra/nhập user ID thủ công.
WITH src(employee_code, manager_code) AS (VALUES
    ('GD001', NULL),
    ('GD002', 'GD001'),
    ('NV003', 'GD001'),
    ('NV004', 'NV010'),
    ('NV005', 'NV010'),
    ('NV007', 'GD002'),
    ('NV008', 'NV010'),
    ('NV009', 'NV010'),
    ('NV010', NULL),
    ('NV011', 'NV068'),
    ('NV012', 'NV037'),
    ('NV014', 'NV037'),
    ('NV015', 'NV037'),
    ('NV016', 'NV037'),
    ('NV017', 'NV068'),
    ('NV018', 'NV010'),
    ('NV019', 'NV010'),
    ('NV020', 'NV037'),
    ('NV021', 'NV037'),
    ('NV022', 'NV068'),
    ('NV023', 'NV010'),
    ('NV025', 'NV037'),
    ('NV026', 'NV037'),
    ('NV028', 'GD002'),
    ('NV029', 'NV010'),
    ('NV030', 'NV037'),
    ('NV031', 'NV010'),
    ('NV032', 'NV068'),
    ('NV033', 'NV068'),
    ('NV034', 'NV068'),
    ('NV035', 'NV068'),
    ('NV036', 'NV010'),
    ('NV037', NULL),
    ('NV038', 'NV010'),
    ('NV039', 'NV010'),
    ('NV040', 'NV068'),
    ('NV041', 'NV010'),
    ('NV044', 'NV010'),
    ('NV045', 'NV010'),
    ('NV046', 'NV068'),
    ('NV047', 'NV010'),
    ('NV048', 'NV010'),
    ('NV049', 'NV010'),
    ('NV050', 'NV037'),
    ('NV051', 'GD002'),
    ('NV052', 'NV068'),
    ('NV053', 'NV010'),
    ('NV054', 'NV010'),
    ('NV055', 'NV037'),
    ('NV056', 'NV010'),
    ('NV057', 'NV037'),
    ('NV058', 'NV010'),
    ('NV059', 'NV037'),
    ('NV061', 'NV010'),
    ('NV062', 'NV068'),
    ('NV064', 'NV037'),
    ('NV065', 'NV010'),
    ('NV067', 'NV068'),
    ('NV068', NULL),
    ('NV069', 'NV037'),
    ('NV070', 'GD002'),
    ('NV071', 'NV010'),
    ('NV073', 'NV010'),
    ('NV076', 'NV010'),
    ('NV077', 'NV010'),
    ('NV081', 'NV010'),
    ('NV085', 'NV068'),
    ('NV086', 'NV068'),
    ('NV088', 'NV068'),
    ('NV090', 'NV068'),
    ('NV093', 'NV010'),
    ('NV095', 'NV010'),
    ('NV101', 'NV010'),
    ('NV102', 'NV068'),
    ('NV107', 'NV068'),
    ('NV115', 'NV010'),
    ('NV117', 'NV010'),
    ('NV118', 'NV068'),
    ('NV122', 'NV068'),
    ('NV126', 'NV068'),
    ('NV129', 'NV010'),
    ('NV131', 'NV068'),
    ('NV132', 'NV068'),
    ('NV138', 'NV068'),
    ('NV146', 'NV037'),
    ('NV148', 'NV068'),
    ('NV151', 'NV068'),
    ('NV154', 'NV010'),
    ('NV156', 'NV010'),
    ('NV157', 'NV068'),
    ('NV161', 'NV010'),
    ('NV162', 'NV068'),
    ('NV168', 'GD002'),
    ('NV171', 'NV068'),
    ('NV170', 'NV068'),
    ('NV178', 'NV068'),
    ('NV177', 'NV068'),
    ('NV181', 'NV068'),
    ('NV184', 'NV010'),
    ('NV197', 'NV068'),
    ('NV204', 'NV068'),
    ('NV205', 'NV068'),
    ('NV206', 'NV010'),
    ('NV214', 'NV010'),
    ('NV216', 'NV037'),
    ('NV217', 'NV068'),
    ('NV219', 'NV068'),
    ('NV225', 'GD002'),
    ('NV227', 'NV068'),
    ('NV231', 'NV068'),
    ('NV232', 'NV010'),
    ('NV237', 'NV068'),
    ('NV239', 'NV010'),
    ('NV241', 'NV068'),
    ('NV243', 'NV068'),
    ('NV244', 'NV068'),
    ('NV252', 'NV068'),
    ('NV255', 'NV010'),
    ('NV257', 'NV068'),
    ('NV259', 'NV068'),
    ('NV261', 'NV068'),
    ('NV263', 'NV068'),
    ('NV264', 'NV068'),
    ('NV270', 'NV068'),
    ('NV271', 'NV068'),
    ('NV277', 'NV068'),
    ('NV280', 'NV068'),
    ('NV281', 'NV068'),
    ('NV282', 'NV068'),
    ('NV288', 'NV010'),
    ('NV289', 'NV010'),
    ('NV290', 'NV068'),
    ('NV294', 'GD002'),
    ('NV295', 'NV010'),
    ('NV298', 'NV068'),
    ('NV299', 'NV010'),
    ('NV302', 'NV010'),
    ('NV303', 'NV010'),
    ('NV304', 'NV068'),
    ('NV310', 'NV068'),
    ('NV311', 'NV068'),
    ('NV315', 'NV068'),
    ('NV316', 'NV003'),
    ('NV317', 'NV010'),
    ('NV318', 'NV010'),
    ('NV319', 'NV068'),
    ('NV321', 'NV003'),
    ('NV324', 'NV068'),
    ('NV325', 'NV068'),
    ('NV326', 'NV010'),
    ('NV329', 'NV068'),
    ('NV330', 'NV068'),
    ('NV331', 'NV068'),
    ('NV332', 'NV068'),
    ('NV333', 'NV068'),
    ('NV335', 'NV068'),
    ('NV080', 'NV068'),
    ('NV336', 'NV010'),
    ('NV337', 'NV068'),
    ('NV338', 'NV068'),
    ('NV339', 'NV068'),
    ('NV341', 'GD002'),
    ('NV342', 'NV068'),
    ('NV343', 'NV068'),
    ('NV344', 'NV068'),
    ('NV345', 'NV068'),
    ('NV346', 'NV068'),
    ('NV347', 'NV068')
)
UPDATE users u
SET manager_id = mgr.id, updated_at = NOW()
FROM src s
LEFT JOIN users mgr ON mgr.employee_code = s.manager_code
WHERE u.employee_code = s.employee_code
  AND (s.manager_code IS NULL OR mgr.id IS NOT NULL);

COMMIT;

-- Kiểm tra kết quả sau khi commit:
-- SELECT employee_code, full_name, email, role, d.name AS department,
--        position, hire_date, m.full_name AS manager
-- FROM users u LEFT JOIN departments d ON d.id=u.department_id
-- LEFT JOIN users m ON m.id=u.manager_id
-- WHERE u.employee_code IS NOT NULL ORDER BY employee_code;
