# Quản lý nghỉ phép & đơn ra ngoài

Ứng dụng web nội bộ của Tri Thức Việt để quản lý hồ sơ nhân sự, đơn nghỉ phép, đơn ra ngoài, phê duyệt, ngày lễ và báo cáo theo phạm vi dữ liệu của người dùng.

## Chức năng hiện có

- Đăng nhập bằng email và mật khẩu; mật khẩu được lưu dưới dạng bcrypt hash. Session được lưu trong PostgreSQL, thời hạn 7 ngày, cookie `HttpOnly` và `SameSite=Lax`.
- Tạo, xem và theo dõi đơn nghỉ phép; chọn nghỉ cả ngày hoặc nửa ngày, người thay thế và ghi chú bàn giao. Số ngày phép loại trừ Chủ Nhật và ngày lễ đang hoạt động; thứ Hai đến thứ Bảy được tính là ngày làm việc.
- Quản lý hạn mức nghỉ theo nhân viên/năm; đơn đang chờ được tính vào ngày đã giữ chỗ. Nhân viên có thể sửa/hủy đơn khi còn ở trạng thái cho phép; thay đổi được ghi lịch sử.
- Nộp ảnh/PDF giấy nghỉ phép đã ký cho đơn chờ giấy. Tệp được lưu riêng trong PostgreSQL và tải qua route có xác thực/phân quyền.
- Tạo đơn ra ngoài theo ngày, giờ, mục đích và lý do. Hệ thống kiểm tra giờ hợp lệ, tính thời lượng dự kiến và phát hiện khoảng giờ bị trùng.
- Người được ghi trong `users.manager_id` có thể xử lý đơn theo kiểm tra phía server. Với đơn ra ngoài, người đã duyệt có thể xác nhận hoàn tất khi nhân viên quay về.
- Danh bạ nhân sự theo phạm vi tài khoản; hỗ trợ tìm kiếm, lọc phòng ban/team, trạng thái nhân sự, người chưa được phân bổ và nhân viên chưa có hạn mức phép.
- Dashboard theo vai trò, các chỉ số có thể mở danh sách chi tiết; báo cáo được giới hạn theo scope người đăng nhập.
- Theo dõi đơn ra ngoài đã hoàn tất: so sánh giờ kết thúc đăng ký với thời điểm người duyệt xác nhận hoàn tất, phân loại đúng/trước giờ hoặc muộn; hiển thị ghi chú xác nhận nếu có.
- Thông báo nội bộ; Web Push là tùy chọn. Endpoint nhắc các đơn đang chờ quá 24 giờ có thể được gọi theo lịch bằng `CRON_SECRET`.
- Quản lý nhân sự tại `/admin/hr` và ngày lễ tại `/holidays` theo quyền được kiểm tra phía server.

> **Giới hạn dữ liệu theo dõi thực tế:** ứng dụng hiện dùng `out_office_requests.updated_at` của lượt `COMPLETED` làm thời điểm xác nhận hoàn tất. Đây là lúc người duyệt xác nhận trên hệ thống, không phải dữ liệu check-in/GPS hay giờ rời công ty được ghi nhận tự động. Ghi chú có thể chứa giờ nhân viên báo lại, nhưng chưa phải trường giờ đi/về riêng có cấu trúc.

## Vai trò và phạm vi dữ liệu

| Vai trò | Phạm vi xem hiện tại | Tạo đơn cá nhân | Ghi chú quyền hiện tại |
| --- | --- | --- | --- |
| `STAFF` | Đơn cá nhân; danh bạ theo scope cá nhân | Có | Quyền duyệt phụ thuộc quan hệ `manager_id` như mô tả bên dưới. |
| `TEAM_LEAD` | Đơn cá nhân và nhân sự/đơn trong team được gán | Có | Code hiện cho phép duyệt nếu được đặt làm `manager_id`. |
| `MANAGER` | Đơn cá nhân và phòng ban | Có | Có thể duyệt khi là người được gán trực tiếp. |
| `ACCOUNTANT` | Toàn công ty khi tra cứu/báo cáo; đọc danh sách đơn của người khác | Có | **Code hiện vẫn cho phép duyệt nếu được gán trong `manager_id`;** xem phần lưu ý đối chiếu chính sách. |
| `DIRECTOR` | Toàn công ty | Không | Xem toàn bộ; phê duyệt theo quan hệ `manager_id` hiện có, không tự động bỏ qua bước gán. |
| `ADMIN` | Chức năng quản trị được cấp | Không | Trang HR chỉ cho tài khoản `admin@trithucvietbn.com`; quyền quản lý ngày lễ kiểm tra role `ADMIN`. Không vào các module đơn nghiệp vụ. |

Scope đọc được xây dựng phía server trong `lib/auth/data-scope.ts`; tham số lọc từ client không thay thế hoặc bỏ qua scope đó. Với tài khoản không được gán phòng/team, phạm vi mặc định là dữ liệu cá nhân.

### Lưu ý quan trọng: quyền duyệt trong code và chính sách nghiệp vụ

Hiện tại, `canApproveWorkflowRequests()` và `canApproveOutOfficeRequests()` chỉ loại `ADMIN`; workflow sau đó xác thực người duyệt bằng `applicant.manager_id === approver.id`. Vì vậy, vai trò `STAFF`, `TEAM_LEAD` hoặc `ACCOUNTANT` vẫn có thể duyệt nếu dữ liệu `manager_id` gán đơn cho họ. Tương tự, `DIRECTOR` xem được toàn công ty nhưng không được tự động duyệt mọi đơn nếu không phải người được gán trực tiếp.

Nếu chính sách cần **chỉ MANAGER duyệt cấp phòng, DIRECTOR duyệt toàn công ty, TEAM_LEAD/STAFF/ACCOUNTANT không duyệt**, cần cập nhật permission và workflow server-side; README này ghi đúng hành vi code hiện tại, không xem đó là bảo đảm chính sách.

### Luồng đơn đang được triển khai

**Nghỉ phép:**

```text
PENDING ── người được gán trực tiếp qua manager_id duyệt ──> WAITING_FOR_DOC
   ├── từ chối ──> REJECTED
   └── sau khi được duyệt: chủ đơn nộp giấy đã ký ──> COMPLETED
```

Evaluator hiện tại chuyển đơn được duyệt sang `WAITING_FOR_DOC` bất kể số ngày nghỉ. `APPROVED_BY_LEAD` còn tồn tại trong kiểu trạng thái, migration và một số truy vấn để tương thích dữ liệu/hiển thị cũ, nhưng nhánh duyệt hiện tại không triển khai quy tắc tự động `Manager → Director` cho đơn từ 2 ngày.

**Đơn ra ngoài:**

```text
PENDING ── người được gán duyệt ──> APPROVED
APPROVED ── chính người đã duyệt xác nhận hoàn tất ──> COMPLETED
PENDING hoặc APPROVED ── từ chối hợp lệ ──> REJECTED
```

## Cài đặt và chạy ứng dụng

### Yêu cầu

- Node.js tương thích Next.js 14 (khuyến nghị Node.js 20 LTS).
- PostgreSQL.
- `psql` nếu áp dụng migration bằng dòng lệnh; có thể dùng DBeaver thay thế.

### Cấu hình

```bash
npm install
```

Sao chép `.env.example` thành `.env.local`, sau đó sửa thông tin kết nối. Không commit `.env`, `.env.local` hoặc secrets vào Git.

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/quan_ly_nghi_phep
CRON_SECRET=thay_bang_chuoi_ngau_nhien_dai_va_bao_mat
```

`lib/db/pool.ts` cũng hỗ trợ cấu hình riêng `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` nếu không đặt `DATABASE_URL`.

### Tạo database và áp dụng migration

PostgreSQL phải có database đích trước khi chạy migration. Ví dụ lỗi `database "quan_ly_nghi_phep" does not exist` xảy ra khi kết nối đến database chưa được tạo; tạo database từ một database quản trị có sẵn trước:

```sql
CREATE DATABASE quan_ly_nghi_phep;
```

Sau đó kết nối **đúng database `quan_ly_nghi_phep`** và chạy từng file SQL theo thứ tự bên dưới. Có thể dùng DBeaver (chọn đúng connection/database và chạy bằng chế độ Execute Script) hoặc `psql`. Nếu dùng PowerShell, nạp URI vào biến môi trường của cửa sổ terminal hiện tại (thay bằng thông tin thật; không ghi mật khẩu thật vào README/Git):

```powershell
$env:DATABASE_URL = "postgresql://postgres:your_password@localhost:5432/quan_ly_nghi_phep"

$files = @(
  "migrations/001_initial_database.sql",
  "migrations/002_performance_indexes.sql",
  "migrations/003_push_notifications.sql",
  "migrations/004_profile_avatars.sql",
  "migrations/005_login_rate_limits.sql",
  "migrations/006_leave_balance_history_and_reminders.sql",
  "migrations/007_leave_and_employee_details.sql",
  "migrations/008_in_app_notifications.sql"
)

foreach ($file in $files) {
  psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $file
  if ($LASTEXITCODE -ne 0) { throw "Migration thất bại: $file" }
}
```

Chạy các file theo đúng thứ tự và chỉ một lần trên database mới. Trên database đã có dữ liệu, sao lưu trước, kiểm tra trạng thái schema và xác định migration nào đã áp dụng; không chạy lại cả bộ một cách mù quáng. Ứng dụng **không tự chạy migration khi khởi động**.

Nếu PostgreSQL báo `25P02 current transaction is aborted`, đó thường là lỗi phát sinh sau một câu lệnh trước đó đã thất bại trong transaction. Tìm lỗi đầu tiên trong log, xử lý nguyên nhân rồi chạy lại migration phù hợp; không coi `25P02` là nguyên nhân gốc.

| Migration | Nội dung chính |
| --- | --- |
| `001_initial_database.sql` | Schema nền: nhân viên, phòng ban, team, đơn nghỉ/ra ngoài, session, lịch sử duyệt, ngày lễ và dữ liệu khởi tạo. |
| `002_performance_indexes.sql` | Chỉ mục phục vụ truy vấn. |
| `003_push_notifications.sql` | Đăng ký Web Push. |
| `004_profile_avatars.sql` | Ảnh đại diện hồ sơ. |
| `005_login_rate_limits.sql` | Giới hạn thử đăng nhập. |
| `006_leave_balance_history_and_reminders.sql` | Hạn mức phép, lịch sử sửa/hủy, nhắc việc và role `ADMIN`. |
| `007_leave_and_employee_details.sql` | Buổi nghỉ, người thay thế, ghi chú bàn giao, trạng thái nhân sự và audit log. |
| `008_in_app_notifications.sql` | Thông báo nội bộ và chỉ mục tra cứu. |

### Chạy ở chế độ phát triển và production

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Cấu hình `next.config.mjs` dùng `.next-dev` khi chạy development và `.next` khi build production để tách cache.

Build và chạy production:

```bash
npm run build
npm run start
```

Các lệnh được khai báo trong `package.json`: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm run seed`. Checkout hiện chưa có ESLint binary/config nên `npm run lint` cần được cấu hình trước khi dùng; kiểm tra TypeScript bằng `npx tsc --noEmit`. Repo chưa khai báo bộ test tự động riêng.

## Web Push và nhắc việc (tùy chọn)

Tạo cặp VAPID key:

```bash
npx web-push generate-vapid-keys
```

Cấu hình ở môi trường server:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@your-company.example
```

Không đưa `VAPID_PRIVATE_KEY` vào client hoặc Git. Web Push cần migration `003_push_notifications.sql` và người nhận bật thông báo trên thiết bị. Nếu không cấu hình VAPID, các luồng chính vẫn hoạt động nhưng không gửi push.

Để nhắc các đơn chờ quá 24 giờ, cấu hình cron bên ngoài gọi `GET /api/notifications/reminders` mỗi ngày với header `Authorization: Bearer <CRON_SECRET>`. Endpoint cần migration `006_leave_balance_history_and_reminders.sql`; không công khai `CRON_SECRET` phía client.

## Dữ liệu kiểm thử

`npm run seed` chạy `scripts/seed-auth-data.js`, tạo/cập nhật tài khoản và dữ liệu demo dùng chung mật khẩu kiểm thử. Script từ chối chạy trong production và yêu cầu đặt `ALLOW_DEMO_SEED=1`. Chỉ chạy trong database phát triển/thử nghiệm cô lập; không chạy trên database nhân viên thật. Sau khi kiểm thử, xóa dữ liệu demo hoặc đổi mật khẩu.

PowerShell:

```powershell
$env:ALLOW_DEMO_SEED = "1"
npm run seed
Remove-Item Env:ALLOW_DEMO_SEED
```

## Cấu trúc chính

```text
app/                         App Router: trang, Server Actions và API routes
  (dashboard)/employees/     Danh bạ nhân sự theo scope
  (dashboard)/dashboard/     Chi tiết drill-down dashboard
  (dashboard)/admin/hr/      Quản trị nhân sự
  (dashboard)/leave/         Đơn nghỉ phép
  (dashboard)/out-office/    Đơn ra ngoài
components/                  Form và giao diện
lib/auth/                    Đăng nhập, session, scope và quyền
lib/admin/                   Truy vấn/quản trị nhân sự
lib/dashboard/               Truy vấn chỉ số dashboard
lib/employees/               Truy vấn danh bạ nhân sự
lib/leave/                   Workflow, query và action nghỉ phép
lib/out-office/              Workflow, query và action đơn ra ngoài
lib/holidays/                Ngày lễ
lib/notifications/           Thông báo và Web Push
migrations/                  Migration PostgreSQL 001–008
scripts/                     Seed dữ liệu kiểm thử
```

## Bảo mật và vận hành

- Kiểm tra quyền và scope diễn ra ở server; không tin `user_id`, role hoặc scope do client gửi lên.
- Mật khẩu dùng bcrypt. Session token ngẫu nhiên được lưu phía server; cookie production đặt `Secure`.
- Giấy nghỉ phép lưu trong PostgreSQL, không phải URL công khai; tải giấy cần đăng nhập và quyền xem.
- Dùng tài khoản PostgreSQL quyền tối thiểu, bật HTTPS khi triển khai, quản lý secrets ngoài source và sao lưu/khôi phục định kỳ.
- Tài khoản seed, mật khẩu dùng chung và dữ liệu mẫu chỉ dành cho môi trường thử nghiệm.
