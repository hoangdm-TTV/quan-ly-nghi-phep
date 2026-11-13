# Quản lý nghỉ phép & đơn ra ngoài

Ứng dụng web nội bộ của Tri Thức Việt để quản lý hồ sơ nhân sự, đơn nghỉ phép, đơn ra ngoài, phê duyệt, ngày lễ và báo cáo theo phạm vi dữ liệu của người dùng.

## Chức năng hiện có

- Đăng nhập bằng email và mật khẩu; mật khẩu được lưu dưới dạng bcrypt hash. Session được lưu trong PostgreSQL, thời hạn 7 ngày, cookie `HttpOnly` và `SameSite=Lax`.
- Tạo, xem và theo dõi đơn nghỉ phép; chọn nghỉ cả ngày hoặc nửa ngày, người thay thế và ghi chú bàn giao. Số ngày phép loại trừ Chủ Nhật và ngày lễ đang hoạt động; thứ Hai đến thứ Bảy được tính là ngày làm việc.
- Quản lý hạn mức nghỉ theo nhân viên/năm; đơn đang chờ được tính vào ngày đã giữ chỗ. Nhân viên có thể sửa/hủy đơn khi còn ở trạng thái cho phép; thay đổi được ghi lịch sử.
- Nộp ảnh/PDF giấy nghỉ phép đã ký cho đơn chờ giấy. Tệp được lưu riêng trong PostgreSQL và tải qua route có xác thực/phân quyền.
- Tạo đơn ra ngoài theo ngày, giờ, mục đích và lý do. Hệ thống kiểm tra giờ hợp lệ, tính thời lượng dự kiến và phát hiện khoảng giờ bị trùng.
- Nghỉ phép: Director cũng tạo được đơn cá nhân. Đơn từ 2 ngày của nhân viên có thể theo luồng Manager → Director hoặc Director duyệt trực tiếp khi còn `PENDING`; riêng đơn nghỉ của chính Director do `manager_id` duyệt một lần để tránh tự duyệt. Đơn ra ngoài của Director cũng chuyển tới `manager_id` theo luồng một cấp hiện tại.
- Danh bạ nhân sự theo phạm vi tài khoản; hỗ trợ tìm kiếm, lọc phòng ban/team, trạng thái nhân sự, người chưa được phân bổ và nhân viên chưa có hạn mức phép.
- Dashboard theo vai trò, các chỉ số có thể mở danh sách chi tiết; báo cáo được giới hạn theo scope người đăng nhập.
- Theo dõi đơn ra ngoài đã hoàn tất: so sánh giờ kết thúc đăng ký với thời điểm người duyệt xác nhận hoàn tất, phân loại đúng/trước giờ hoặc muộn; hiển thị ghi chú xác nhận nếu có.
- Thông báo nội bộ; Web Push là tùy chọn. Endpoint nhắc các đơn đang chờ quá 24 giờ có thể được gọi theo lịch bằng `CRON_SECRET`.
- Quản lý nhân sự tại `/admin/hr` và ngày lễ tại `/holidays` theo quyền được kiểm tra phía server.

> **Giới hạn dữ liệu theo dõi thực tế:** ứng dụng hiện dùng `out_office_requests.updated_at` của lượt `COMPLETED` làm thời điểm xác nhận hoàn tất. Đây là lúc người duyệt xác nhận trên hệ thống, không phải dữ liệu check-in/GPS hay giờ rời công ty được ghi nhận tự động. Ghi chú có thể chứa giờ nhân viên báo lại, nhưng chưa phải trường giờ đi/về riêng có cấu trúc.

## Ma trận phân quyền

Bảng dưới mô tả **quyền đang được code thực thi**, tách phạm vi xem khỏi người có thể xử lý đơn. Riêng đơn ra ngoài, người duyệt được xác định bằng `manager_id` của người xin; đây là workflow một cấp.

| Vai trò | Xem đơn / báo cáo | Danh bạ nhân sự | Tạo đơn cá nhân | Duyệt nghỉ phép | Duyệt đơn ra ngoài |
| --- | --- | --- | --- | --- | --- |
| `STAFF` | Đơn cá nhân | Cá nhân | Có | Không | Người này xử lý được nếu được gán làm `manager_id` |
| `TEAM_LEAD` | Đơn cá nhân và đơn trong team nếu được gán team | Team | Có | Không | Người này xử lý được nếu được gán làm `manager_id` |
| `MANAGER` | Đơn cá nhân và đơn trong phòng ban | Phòng ban | Có | Đơn `PENDING` có `manager_id` trỏ tới Manager; đơn từ 2 ngày chuyển Director, trừ đơn của Director | Người này xử lý được nếu được gán làm `manager_id` |
| `ACCOUNTANT` | Toàn công ty (danh sách/báo cáo; trang chi tiết đơn người khác chỉ đọc) | Toàn công ty | Có | Không | Nếu được gán làm `manager_id`, queue hiện có thao tác; trang chi tiết ghi chỉ đọc |
| `DIRECTOR` | Toàn công ty và đơn cá nhân | Toàn công ty | Có | Đơn cá nhân do `manager_id` duyệt một lần. Đơn người khác từ 2 ngày có thể duyệt trực tiếp hoặc duyệt cấp 2 | Người này xử lý đơn nếu được gán làm `manager_id`; không có bước duyệt Director tự động |
| `ADMIN` | Không vào module đơn nghiệp vụ; toàn công ty trong khu vực quản trị | Khu vực quản trị | Không | Không | UI queue bị chặn; Server Action chưa chặn role nếu gọi trực tiếp và thỏa quan hệ ID |

Scope đọc danh sách được tạo phía server trong `lib/auth/data-scope.ts`: `MANAGER` thấy phòng ban, `TEAM_LEAD` thấy team khi đã được gán `team_id`, `DIRECTOR` và `ACCOUNTANT` thấy toàn công ty; người không có scope chỉ thấy đơn cá nhân. Quyền duyệt nghỉ phép được giới hạn cho `MANAGER` và `DIRECTOR`. Lưu ý: queue và workflow nghỉ phép xác định Manager bằng `manager_id`; Server Action hiện **không kiểm tra thêm** `applicant.department_id === manager.department_id`. Vì vậy phạm vi danh sách của Manager là phòng ban, nhưng việc được phép duyệt hiện dựa trên liên kết `manager_id`, không phải kiểm tra phòng ban độc lập.

> **Cách hiểu quyền duyệt đơn ra ngoài:** hệ thống dùng đúng một người duyệt theo `manager_id`; người duyệt này xác nhận đơn trước khi đi và cùng `approver_id` xác nhận khi người xin về. Server Action kiểm tra đăng nhập và quan hệ ID, không kiểm tra riêng role của người được gán. Vì vậy cần bảo đảm `manager_id` luôn trỏ tới tài khoản quản lý được chỉ định; UI queue hiện cho mọi role trừ `ADMIN`, còn Server Action chưa chặn role khi bị gọi trực tiếp. Đơn cá nhân của mọi role nghiệp vụ, gồm Director, yêu cầu có `manager_id` hợp lệ; `ADMIN` không được tạo đơn.

### Luồng nghỉ phép đang chạy

- Dưới 2 ngày: Manager được gán trong `manager_id` duyệt một cấp. Director chỉ duyệt trực tiếp trong các nhánh dự phòng của workflow: người xin là Manager/Director được gán Director, hoặc không có Manager đang hoạt động trong phòng ban và Director xử lý trực tiếp.
- Từ 2 ngày trở lên, với người xin không phải Director: Manager có thể duyệt cấp 1, chuyển đơn sang `APPROVED_BY_LEAD` để Director duyệt cấp 2; hoặc Director có thể duyệt đơn đang `PENDING` trực tiếp, chuyển thẳng sang `WAITING_FOR_DOC` và bỏ qua Manager.
- Ngoại lệ đơn của chính Director: người được gán trong `manager_id` duyệt một lần là hoàn tất kể cả đơn từ 2 ngày; Director không tự duyệt và đơn không chuyển sang `APPROVED_BY_LEAD`.
- Khi Director duyệt trực tiếp đơn từ 2 ngày của người khác, đơn rời `PENDING` và không còn nằm trong queue Manager. Tất cả người dùng, gồm Director, vẫn cần `manager_id` hợp lệ khi tạo đơn.
- Người có thẩm quyền ở cấp hiện tại có thể từ chối; từ chối chuyển đơn sang `REJECTED`. Khi đơn vào `WAITING_FOR_DOC`, chủ đơn nộp giấy đã ký để chuyển sang `COMPLETED`.

```mermaid
flowchart TD
    A[Người dùng gửi đơn] --> B[PENDING]
    B --> A2{Người xin là Director?}
    A2 -- Có --> A3[manager_id duyệt một lần]
    A3 -- Từ chối --> R[REJECTED]
    A3 -- Duyệt --> W[WAITING_FOR_DOC]
    A2 -- Không --> C{Số ngày nghỉ?}
    C -- Dưới 2 ngày --> E{Ai được gán xử lý?}
    E -- MANAGER --> P{MANAGER quyết định}
    P -- Từ chối --> R[REJECTED]
    P -- Duyệt --> W[WAITING_FOR_DOC]
    E -- DIRECTOR theo nhánh dự phòng --> J[DIRECTOR duyệt trực tiếp]
    J -- Từ chối --> R
    J -- Duyệt --> W
    C -- Từ 2 ngày trở lên --> Q{Ai duyệt khi đơn còn PENDING?}
    Q -- MANAGER duyệt trước --> F{MANAGER duyệt cấp 1}
    F -- Từ chối --> R
    F -- Duyệt --> G[APPROVED_BY_LEAD]
    G --> H[Hàng đợi DIRECTOR]
    H --> I{DIRECTOR duyệt cấp 2}
    I -- Từ chối --> R
    I -- Duyệt --> W
    Q -- DIRECTOR duyệt trước --> K[DIRECTOR duyệt trực tiếp; bỏ qua MANAGER]
    K -- Từ chối --> R
    K -- Duyệt --> W
    W --> N[Chủ đơn nộp giấy đã ký]
    N --> L[COMPLETED]
    B --> M[Chủ đơn hủy khi trạng thái cho phép]
    M --> O[CANCELLED]
```

Mốc chuyển cấp là `duration_days >= 2` (ngày phép đã tính theo lịch làm việc). Queue Manager lấy đơn `PENDING` có `users.manager_id` trùng tài khoản đó. Queue Director gồm đơn `PENDING` từ 2 ngày của người xin không phải Director, đơn `PENDING` có `manager_id` trùng Director và thỏa nhánh được gán/dự phòng, cùng đơn `APPROVED_BY_LEAD` từ 2 ngày. **Điểm cần biết:** evaluator cho Director duyệt trực tiếp đơn dưới 2 ngày khi phòng ban không có Manager đang hoạt động, nhưng query queue nhánh này vẫn yêu cầu `manager_id` trỏ tới Director; nếu không, đơn có thể không hiện trong queue dù Director có thể mở từ danh sách toàn công ty và xử lý ở trang chi tiết. Đơn của Director chỉ do người được gán trong `manager_id` xử lý. Lịch sử ghi `APPROVED_LEAD` khi Manager duyệt và `APPROVED_DIRECTOR` khi Director duyệt trực tiếp hoặc duyệt cấp hai.

### Luồng đơn ra ngoài đang triển khai

```mermaid
flowchart TD
    A[Người đủ điều kiện trên UI gửi đơn] --> B[PENDING]
    B --> C{Người đăng nhập có id = manager_id?}
    C -- Không --> X[Evaluator từ chối thao tác]
    C -- Có / duyệt --> D[APPROVED]
    C -- Có / từ chối --> R[REJECTED]
    D --> E{Đúng approver_id đã duyệt?}
    E -- Không --> X
    E -- Có / xác nhận đã về --> F[COMPLETED]
    E -- Có / từ chối --> R
```

Đây là luồng **một cấp theo `manager_id`**, không tự chuyển Manager → Director. Queue lấy đơn `PENDING` có `manager_id` trùng tài khoản đang đăng nhập và đơn `APPROVED` có `approver_id` trùng tài khoản đó; cùng người đã duyệt mới được xác nhận hoàn tất khi người xin về. Giao diện queue cho mọi role trừ `ADMIN`; Server Action kiểm tra đăng nhập và quan hệ ID nhưng không xác thực riêng role. Component chỉ hiện nút xác nhận về ở trạng thái `APPROVED`, tuy nhiên Server Action từ chối vẫn chấp nhận trạng thái này nếu cùng người duyệt gọi.

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
