# Quản lý nghỉ phép & đơn ra ngoài

Ứng dụng web nội bộ của Tri Thức Việt để tạo, theo dõi và phê duyệt đơn nghỉ phép, đơn xin ra ngoài, quản lý ngày lễ và đối soát theo phạm vi người dùng.

## Chức năng

- Đăng nhập bằng tài khoản công ty; session lưu phía server.
- Đổi mật khẩu từ hồ sơ cá nhân; mật khẩu mới tối thiểu 6 ký tự và các phiên khác bị thu hồi.
- Quản lý hạn mức phép theo nhân viên/năm; đơn mới và đơn sửa được giữ chỗ số ngày khi chờ duyệt.
- Người tạo có thể sửa hoặc hủy đơn nghỉ/ra ngoài khi còn `PENDING`; thay đổi được ghi lịch sử.
- Tài khoản `admin@trithucvietbn.com` quản lý hồ sơ nhân sự, phòng ban, team, quản lý trực tiếp, hạn mức phép và ngày lễ; người duyệt được gán trực tiếp qua `users.manager_id`.
- Danh sách có phân trang; có thể tải CSV UTF-8 tương thích Excel theo bộ lọc và quyền truy cập.
- Thông báo nội bộ trong ứng dụng cho người xin đơn/người duyệt; Web Push là tùy chọn bổ sung. Chuông thông báo có số chưa đọc, xem chi tiết và đánh dấu đã đọc; endpoint cron ghi cả nhắc hằng ngày cho đơn chờ xử lý quá 24 giờ.
- Tạo và theo dõi đơn nghỉ phép. Số ngày được tính theo ngày làm việc từ thứ Hai đến thứ Bảy, bỏ Chủ Nhật và ngày lễ đang hoạt động.
- Duyệt nghỉ phép một cấp: mỗi đơn được chuyển trực tiếp cho người có `id = users.manager_id` của người tạo đơn; không còn cấp duyệt thứ hai.
- Sau khi được duyệt, chủ đơn tải giấy đã ký để hoàn tất. Ảnh PNG/JPEG được tự động resize và chuyển sang JPEG, dung lượng sau nén tối đa 5 MB; PDF giữ nguyên, tối đa 50 MB. Tệp lưu trong PostgreSQL và chỉ tải qua endpoint đã xác thực.
- Tạo đơn ra ngoài theo ngày, giờ, mục đích và lý do. Hệ thống tự tính thời lượng, từ chối khoảng giờ không hợp lệ và phát hiện đơn bị trùng.
- Người duyệt đơn ra ngoài xác nhận lúc nhân viên quay về để chuyển đơn sang hoàn tất.
- Lịch sử phê duyệt, thông báo Web Push tùy chọn, hồ sơ cá nhân, đổi mật khẩu và ảnh đại diện.
- Quản lý ngày lễ (chỉ ADMIN), lọc danh sách và dashboard thống kê theo phạm vi quyền.
- Báo cáo quản trị theo phạm vi quyền: tổng hợp ngày nghỉ theo phòng ban, tỷ trọng nghỉ theo tháng, top nhân viên nghỉ nhiều, thời gian xử lý trung bình, đơn chờ theo người duyệt, nhân viên chưa có hạn mức và đơn ra ngoài được xác nhận về muộn.
- Báo cáo được hiển thị cho ADMIN (toàn công ty), TEAM_LEAD (trong team), MANAGER (trong phòng ban), ACCOUNTANT và DIRECTOR (toàn công ty). Hệ thống chưa ghi nhận giờ rời đi thực tế nên chưa thể kết luận chính xác tình trạng đi muộn.
- Báo cáo có bộ lọc theo ngày với nút `Lọc` và `Xóa bộ lọc`; khi chưa lọc, lịch vắng mặt hiển thị toàn bộ đơn đã duyệt trong phạm vi quyền của người dùng.

## Vai trò và phạm vi

| Vai trò      | Phạm vi dữ liệu                                              | Quyền chính                                                                                                                      |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `STAFF`      | Đơn cá nhân                                                  | Tạo đơn; đơn được người có `id = users.manager_id` duyệt                                                                    |
| `TEAM_LEAD`  | Đơn cá nhân và đơn trong team                                | Tạo đơn; duyệt các đơn được gán trực tiếp qua `manager_id`                                                                  |
| `MANAGER`    | Đơn cá nhân và trong phòng ban                               | Tạo đơn; xem trong phòng ban; duyệt các đơn được gán trực tiếp qua `manager_id`                                              |
| `ACCOUNTANT` | Toàn công ty khi tra cứu/báo cáo; chỉ đọc đơn của người khác | Tạo đơn cá nhân; có thể duyệt nếu được gán qua `manager_id`                                                                  |
| `ADMIN`      | Quản trị nhân sự                                             | Chỉ tài khoản `admin@trithucvietbn.com` được vào trang quản trị và quản lý ngày lễ; không thể cấp quyền ADMIN cho tài khoản khác |
| `DIRECTOR`   | Toàn công ty                                                 | Xem toàn bộ dữ liệu; có thể duyệt nếu được gán qua `manager_id`                                                               |

> Quyền xem và quyền duyệt là hai phần độc lập. Phạm vi xem của DIRECTOR vẫn là toàn công ty; MANAGER vẫn xem chính mình và phòng ban của mình. Quyền duyệt được kiểm tra ở server theo `applicant.manager_id = approver.id`; không người dùng nào được tự duyệt đơn của mình. Nhân viên chưa được gán `manager_id` không thể tạo đơn.

### Luồng nghỉ phép

```text
PENDING ── người được gán qua manager_id duyệt ──> WAITING_FOR_DOC ── nộp giấy ──> COMPLETED

Ở bước chờ duyệt có thể chuyển sang REJECTED. Không còn trạng thái chờ cấp duyệt thứ hai trong nghiệp vụ mới.
```

Ngày nghỉ tính theo lịch làm việc hiện tại: thứ Hai–thứ Bảy là ngày làm việc, Chủ Nhật và ngày lễ đang hoạt động không tính. Đơn có thể chọn cả ngày, buổi sáng hoặc buổi chiều; nghỉ theo buổi tính 0,5 ngày.
Hạn mức được quản lý theo năm bắt đầu của đơn; khi chưa thiết lập hạn mức cho nhân viên/năm, hệ thống vẫn cho gửi đơn.

### Luồng đơn ra ngoài

```text
PENDING ── duyệt ──> APPROVED ── người đã duyệt xác nhận nhân viên về ──> COMPLETED
   └── từ chối ──> REJECTED
```

Mỗi đơn áp dụng trong một ngày; giờ kết thúc phải sau giờ bắt đầu. Từ chối cần có lý do. Người duyệt là tài khoản có `id` bằng `users.manager_id` của người tạo đơn. Người đã duyệt sẽ xác nhận khi nhân viên quay về.

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

3. Áp dụng các migration theo thứ tự `001` → `008` lên đúng database. Có thể dùng DBeaver hoặc `psql`; sao lưu database và kiểm tra schema hiện có trước khi áp dụng trên môi trường đang có dữ liệu.

4. Khởi động ứng dụng:

   ```bash
   npm run dev
   ```

   Mở [http://localhost:3000](http://localhost:3000).

Các lệnh có trong `package.json`: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`. Repo hiện chưa khai báo bộ kiểm thử tự động riêng.

## Database và migrations

Migrations trong thư mục [`migrations/`](migrations) được chạy theo thứ tự `001` → `008`:

| Tệp                                           | Nội dung                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `001_initial_database.sql`                    | Bảng người dùng, phòng ban, team, đơn, lịch sử duyệt, ngày lễ và dữ liệu khởi tạo                      |
| `002_performance_indexes.sql`                 | Chỉ mục cho các truy vấn danh sách và dashboard                                                        |
| `003_push_notifications.sql`                  | Lưu đăng ký Web Push                                                                                   |
| `004_profile_avatars.sql`                     | Lưu ảnh đại diện                                                                                       |
| `005_login_rate_limits.sql`                   | Giới hạn thử đăng nhập theo email                                                                      |
| `006_leave_balance_history_and_reminders.sql` | Hạn mức phép, lịch sử sửa/hủy, trạng thái hủy, nhắc việc, vai trò ADMIN và tài khoản quản trị duy nhất |
| `007_leave_and_employee_details.sql`          | Buổi nghỉ, người thay thế, ghi chú bàn giao, trạng thái nhân sự và audit log                           |
| `008_in_app_notifications.sql`                | Thông báo nội bộ, trạng thái đã đọc/chưa đọc và chỉ mục tra cứu                                        |

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
- Cách gán người duyệt trực tiếp qua `users.manager_id` có phù hợp với quy trình nội bộ không.
- Có cần giới hạn đơn ra ngoài theo giờ làm việc, giới hạn thời lượng hoặc cho phép ngày quá khứ hay không.
- Chính sách lưu trữ và thời hạn giữ giấy nghỉ phép, lịch sử phê duyệt và dữ liệu tài khoản.
