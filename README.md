# Quản lý nghỉ phép & đơn ra ngoài

Ứng dụng web nội bộ của Tri Thức Việt để tạo, theo dõi và phê duyệt đơn nghỉ phép, đơn xin ra ngoài, quản lý ngày lễ và đối soát theo phạm vi người dùng.

## Chức năng

- Đăng nhập bằng tài khoản công ty; session lưu phía server.
- Đổi mật khẩu từ hồ sơ cá nhân; mật khẩu mới tối thiểu 6 ký tự và các phiên khác bị thu hồi.
- Quản lý hạn mức phép theo nhân viên/năm; đơn mới và đơn sửa được giữ chỗ số ngày khi chờ duyệt.
- Người tạo có thể sửa hoặc hủy đơn nghỉ/ra ngoài khi còn `PENDING`; thay đổi được ghi lịch sử.
- Tài khoản `admin@trithucvietbn.com` quản lý hồ sơ nhân sự, phòng ban, team, quản lý trực tiếp, hạn mức phép và ngày lễ; Giám đốc giữ các quyền duyệt đơn.
- Danh sách có phân trang; có thể tải CSV UTF-8 tương thích Excel theo bộ lọc và quyền truy cập.
- Push thông báo cho người xin đơn khi duyệt/từ chối; endpoint cron gửi nhắc hằng ngày cho đơn chờ xử lý quá 24 giờ.
- Tạo và theo dõi đơn nghỉ phép. Số ngày được tính theo ngày làm việc từ thứ Hai đến thứ Bảy, bỏ Chủ Nhật và ngày lễ đang hoạt động.
- Duyệt nghỉ phép theo cấp: đơn tối đa một ngày cần một cấp; đơn trên một ngày cần Trưởng phòng rồi Giám đốc. Đơn của Trưởng phòng do Giám đốc duyệt.
- Sau khi được duyệt, chủ đơn tải giấy đã ký (PDF, PNG hoặc JPEG, tối đa 50 MB) để hoàn tất. Tệp lưu trong PostgreSQL và chỉ tải qua endpoint đã xác thực.
- Tạo đơn ra ngoài theo ngày, giờ, mục đích và lý do. Hệ thống tự tính thời lượng, từ chối khoảng giờ không hợp lệ và phát hiện đơn bị trùng.
- Người duyệt đơn ra ngoài xác nhận lúc nhân viên quay về để chuyển đơn sang hoàn tất.
- Lịch sử phê duyệt, thông báo Web Push tùy chọn, hồ sơ cá nhân, đổi mật khẩu và ảnh đại diện.
- Quản lý ngày lễ (chỉ ADMIN), lọc danh sách và dashboard thống kê theo phạm vi quyền.

## Vai trò và phạm vi

| Vai trò      | Phạm vi dữ liệu                                              | Quyền chính                                                                                              |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `STAFF`      | Đơn cá nhân                                                  | Tạo đơn; đơn nghỉ được Trưởng phòng duyệt; đơn ra ngoài do Trưởng nhóm cùng team duyệt                   |
| `TEAM_LEAD`  | Đơn cá nhân và đơn trong team                                | Tạo đơn; đơn nghỉ do Trưởng phòng cùng phòng ban duyệt; đơn ra ngoài do Trưởng phòng duyệt               |
| `MANAGER`    | Đơn cá nhân và trong phòng ban                               | Tạo đơn; duyệt nghỉ của nhân viên trong phòng ban; duyệt đơn ra ngoài theo cấp trực tiếp                 |
| `ACCOUNTANT` | Toàn công ty khi tra cứu/báo cáo; chỉ đọc đơn của người khác | Tạo đơn cá nhân; đơn nghỉ do Trưởng phòng duyệt; đơn ra ngoài do Trưởng phòng duyệt                      |
| `ADMIN`      | Quản trị nhân sự                                             | Chỉ tài khoản `admin@trithucvietbn.com` được vào trang quản trị và quản lý ngày lễ; không thể cấp quyền ADMIN cho tài khoản khác |
| `DIRECTOR`   | Toàn công ty                                                 | Duyệt cấp cuối nghỉ phép và đơn của Trưởng phòng; duyệt đơn ra ngoài theo cấp trực tiếp |

> Quyền duyệt được kiểm tra ở server. Không người dùng nào được tự duyệt đơn của mình. Với STAFF chưa được gán team, đơn ra ngoài không có cấp duyệt phù hợp cho đến khi hồ sơ được cấu hình.

### Luồng nghỉ phép

```text
PENDING ── duyệt cấp 1, tối đa 1 ngày ──> WAITING_FOR_DOC ── nộp giấy ──> COMPLETED
   │
   └── duyệt cấp 1, trên 1 ngày ──> APPROVED_BY_LEAD ── Giám đốc duyệt ──> WAITING_FOR_DOC

Ở bước chờ duyệt có thể chuyển sang REJECTED.
```

Ngày nghỉ tính theo lịch làm việc hiện tại: thứ Hai–thứ Bảy là ngày làm việc, Chủ Nhật và ngày lễ đang hoạt động không tính. Chưa hỗ trợ nghỉ nửa ngày hoặc nghỉ theo giờ.
Hạn mức được quản lý theo năm bắt đầu của đơn; khi chưa thiết lập hạn mức cho nhân viên/năm, hệ thống vẫn cho gửi đơn theo quy trình duyệt cũ.

### Luồng đơn ra ngoài

```text
PENDING ── duyệt ──> APPROVED ── người đã duyệt xác nhận nhân viên về ──> COMPLETED
   └── từ chối ──> REJECTED
```

Mỗi đơn áp dụng trong một ngày; giờ kết thúc phải sau giờ bắt đầu. Từ chối cần có lý do. Người duyệt trực tiếp theo code hiện tại: STAFF → TEAM_LEAD cùng team; TEAM_LEAD/ACCOUNTANT → MANAGER cùng phòng; MANAGER → DIRECTOR.

## Công nghệ

- Next.js 14 App Router, React 18, TypeScript
- Tailwind CSS, Lucide React
- PostgreSQL qua `pg`
- bcryptjs cho xác minh mật khẩu; Zod cho xác thực dữ liệu
- Server Actions và Route Handlers cho thao tác phía server

## Chạy ở môi trường phát triển

Yêu cầu Node.js tương thích với Next.js 14 và PostgreSQL.

1. Cài dependencies:

   ```bash
   npm install
   ```

2. Tạo `.env.local` từ `.env.example`, sau đó điền kết nối PostgreSQL:

   ```env
   DATABASE_URL=postgresql://app_user:your_password@localhost:5432/quan_ly_nghi_phep
   ```

   Không commit `.env` hoặc `.env.local`.

3. Áp dụng các migration theo thứ tự `001` → `006` lên đúng database. Có thể dùng DBeaver hoặc `psql`; sao lưu database và kiểm tra schema hiện có trước khi áp dụng trên môi trường đang có dữ liệu.

4. Khởi động ứng dụng:

   ```bash
   npm run dev
   ```

   Mở [http://localhost:3000](http://localhost:3000).

Các lệnh có trong `package.json`: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`. Repo hiện chưa khai báo bộ kiểm thử tự động riêng.

## Database và migrations

Migrations trong thư mục [`migrations/`](migrations) được chạy theo thứ tự `001` → `007`:

| Tệp                           | Nội dung                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `001_initial_database.sql`    | Bảng người dùng, phòng ban, team, đơn, lịch sử duyệt, ngày lễ và dữ liệu khởi tạo |
| `002_performance_indexes.sql` | Chỉ mục cho các truy vấn danh sách và dashboard                                   |
| `003_push_notifications.sql`  | Lưu đăng ký Web Push                                                              |
| `004_profile_avatars.sql`     | Lưu ảnh đại diện                                                                  |
| `005_login_rate_limits.sql`   | Giới hạn thử đăng nhập theo email                                                 |
| `006_leave_balance_history_and_reminders.sql` | Hạn mức phép, lịch sử sửa/hủy, trạng thái hủy, nhắc việc, vai trò ADMIN và tài khoản quản trị duy nhất |
| `007_leave_and_employee_details.sql` | Buổi nghỉ, người thay thế, ghi chú bàn giao, trạng thái nhân sự và audit log |

Ứng dụng không tự chạy migration khi khởi động. Hãy áp dụng schema trước khi triển khai phiên bản tương ứng. Cơ sở dữ liệu phải có các bảng và cột mà migration/source yêu cầu; nếu đang dùng schema cũ, cần đối chiếu trước khi chạy.

## Thông báo Web Push (tùy chọn)

Tạo cặp VAPID key:

```bash
npx web-push generate-vapid-keys
```

Thêm vào môi trường server:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@your-company.example
```

Chạy migration `003_push_notifications.sql`, mở ứng dụng qua HTTPS (localhost dùng được khi phát triển), đăng nhập và bật thông báo trên từng trình duyệt/thiết bị. Không đưa `VAPID_PRIVATE_KEY` vào client hoặc commit vào Git. Nếu chưa cấu hình push, luồng tạo đơn vẫn sử dụng được nhưng không gửi thông báo đẩy.

Sau khi áp dụng migration `006`, có thể cấu hình lịch cron mỗi ngày gọi `GET /api/notifications/reminders` với header `Authorization: Bearer <CRON_SECRET>`. Endpoint nhắc đơn chờ quá 24 giờ tối đa một lần mỗi ngày. Đặt `CRON_SECRET` trong môi trường server; không đưa secret vào client. Push tới người xin đơn và nhắc người duyệt cần Web Push được cấu hình, migration `003` đã chạy, và người nhận đã bật thông báo trên thiết bị.

## Tài khoản demo

`scripts/seed-auth-data.js` tạo tài khoản thử nghiệm với mật khẩu dùng chung. Script bị chặn trong production và chỉ chạy khi đặt rõ `ALLOW_DEMO_SEED=1`. Chỉ chạy trên database phát triển/thử nghiệm cô lập; không chạy trên dữ liệu công ty hoặc production.

## Bảo mật và vận hành

- Phân quyền và xác nhận trạng thái thực hiện ở phía server; dữ liệu định danh người tạo lấy từ session.
- Mật khẩu được xác minh bằng bcrypt; session dùng token ngẫu nhiên, cookie `HttpOnly`, `SameSite=Lax` và `Secure` trong production.
- Mật khẩu mới được giới hạn theo dung lượng UTF-8 để tránh giới hạn đầu vào của bcrypt.
- Tệp giấy nghỉ phép lưu riêng tư trong PostgreSQL; endpoint tải yêu cầu đăng nhập và kiểm tra phạm vi truy cập.
- Lỗi database/action trả thông báo chung cho người dùng; chi tiết kỹ thuật chỉ ghi phía server.
- Giới hạn đăng nhập theo email cần migration `005_login_rate_limits.sql`.
- Hạn mức phép, sửa/hủy đơn và nhắc việc cần migration `006_leave_balance_history_and_reminders.sql`.
- Dùng tài khoản PostgreSQL quyền tối thiểu, bật HTTPS khi triển khai, quản lý secrets ngoài source và thiết lập backup/khôi phục định kỳ.

## Cấu trúc chính

```text
app/                 Các trang, layout, API routes
components/          Form và thành phần giao diện
lib/auth/            Đăng nhập, session, quyền và vai trò
lib/leave/           Đơn nghỉ phép, tính ngày, workflow
lib/out-office/      Đơn ra ngoài, tính giờ, workflow
lib/dashboard/       Truy vấn số liệu dashboard
lib/holidays/        Quản lý ngày lễ
lib/notifications/   Web Push
migrations/          Thay đổi schema PostgreSQL
scripts/             Seed và script kiểm tra thủ công
```

## Các quy định cần doanh nghiệp xác nhận

- Lịch làm việc thứ Hai–thứ Bảy và cách loại trừ ngày lễ có phù hợp chính sách công ty không.
- Cấp duyệt đơn ra ngoài theo team/phòng như mô tả trong luồng hiện tại có đúng thực tế không.
- Có cần giới hạn đơn ra ngoài theo giờ làm việc, giới hạn thời lượng hoặc cho phép ngày quá khứ hay không.
- Chính sách lưu trữ và thời hạn giữ giấy nghỉ phép, lịch sử phê duyệt và dữ liệu tài khoản.
