# Báo cáo phân tích ứng dụng Leave & Gate Pass

**Phạm vi:** kiểm tra tĩnh mã nguồn trong `app/`, `components/`, `lib/`, `migrations/`, `scripts/`, `package.json`, `README.md` và cấu hình chính. Không đọc giá trị trong `.env`, không kết nối/chỉnh sửa database, không sửa mã nguồn. Đây là đánh giá dựa trên repository tại thời điểm rà soát, không phải kiểm thử xâm nhập hay xác minh môi trường production.

## 1. Tóm tắt điều hành

Đây là ứng dụng nội bộ quản lý nghỉ phép và xin ra ngoài, xây bằng Next.js 14 App Router, TypeScript, React, Tailwind CSS và PostgreSQL (`pg`). Phần nền tảng đã có: đăng nhập bằng bcrypt, session phía server, lọc truy vấn cá nhân, workflow duyệt nghỉ phép nhiều cấp, đơn ra ngoài, lịch sử phê duyệt và giao diện dashboard.

**Tình trạng:** prototype/MVP đang phát triển, chưa nên coi là sẵn sàng production. Những lý do ưu tiên cao nhất:

1. **Các Server Action duyệt/từ chối có thể trả `err.message` nội bộ về trình duyệt** (`lib/leave/actions.ts:172-175, 260-264`; `lib/out-office/actions.ts:165-168, 244-248`).
2. **Chính sách duyệt đơn ra ngoài không thống nhất:** README nói quản lý trực tiếp/Team Lead/Manager được duyệt; code lại chỉ cho ACCOUNTANT hoặc DIRECTOR (`README.md:60-67`; `lib/out-office/workflow.ts:30-35`).
3. **Chặn đơn trùng chưa chống được gửi đồng thời:** kiểm tra overlap và INSERT tách rời, không ở transaction, không có constraint bảo vệ (`lib/leave/actions.ts:68-90`; `lib/out-office/actions.ts:69-92`).
4. **Quy trình nghỉ phép không thể hoàn tất trên UI:** chưa có upload ảnh giấy đã ký; đơn được duyệt chỉ ở `WAITING_FOR_DOC` (`app/(dashboard)/leave/[id]/page.tsx:112-120`).
5. **Thiếu kiểm soát đăng nhập chống brute-force/rate-limit** và seed chứa tài khoản/mật khẩu dùng chung `123456` (`lib/auth/actions.ts`; `scripts/seed-auth-data.js:80-90, 133-139`). Không dùng thông tin mẫu này trên production.
6. **Tài liệu và phần triển khai lệch nhau ở ngày nghỉ, quyền xem, dashboard và workflow.**
7. Kiểm thử hiện là các script thủ công, nhiều test chỉ mô phỏng logic hoặc assertion hằng; chưa chứng minh production code hoạt động. Không có Vitest/Jest/Playwright trong dependencies.

## 2. Kiến trúc và luồng dữ liệu

```text
Browser UI (Server Components + Client Components)
  ├─ app/(dashboard)/* pages ── requireAuth()
  ├─ components/* forms ─────── Next.js Server Actions
  └─ app/login + login-form ─── loginAction()
                                  │
                                  ├─ lib/auth/session.ts: cookie ID + bảng sessions
                                  ├─ lib/auth/permissions.ts: nạp user hiện hành từ DB
                                  ├─ lib/*/workflow.ts: đánh giá vai trò/trạng thái
                                  └─ lib/db/pool.ts: pg Pool ── PostgreSQL

PostgreSQL tables: users, departments, teams, leave_requests,
out_office_requests, sessions, approval_history
```

**Xác thực:** email/mật khẩu được kiểm tra ở `lib/auth/actions.ts`; mật khẩu xác minh qua bcryptjs trong `lib/auth/password.ts`. Session ID ngẫu nhiên 32 bytes lưu trong DB; cookie `HttpOnly`, `SameSite=Lax`, secure khi `NODE_ENV=production`, hết hạn 7 ngày (`lib/auth/session.ts`). Mỗi lần lấy user hiện hành, ứng dụng kiểm tra session, sau đó đọc hồ sơ `users` và `is_active`.

**Database:** `lib/db/pool.ts` dùng `pg.Pool`, tối đa 10 kết nối; câu truy vấn phần lớn parameterized. Hai migrations tạo schema nghiệp vụ và bổ sung `password_hash`, `sessions`, `approval_history`, timestamps.

**Routes chính:**

- `/login`
- `/` dashboard
- `/leave`, `/leave/new`, `/leave/[id]`
- `/out-office`, `/out-office/new`, `/out-office/[id]`
- `/approvals/leave`, `/approvals/out-office`
- `/profile`

Layout dashboard gọi `requireAuth()` cho các trang thuộc route group. Các Server Action nghiệp vụ cũng tự gọi `requireAuth()`, đây là điểm tốt: ẩn nút UI không phải lớp bảo vệ duy nhất.

## 3. Nghiệp vụ hiện đang được triển khai

### Nghỉ phép

- Nhân viên tạo đơn, server lấy `employee_id` từ session và tự tính `duration_days`.
- Hàm `calculateWorkingDays()` tính ngày làm việc từ thứ Hai đến thứ Bảy, loại Chủ Nhật; không loại ngày lễ (`lib/leave/calculator.ts`).
- STAFF: Team Lead cùng team hoặc Manager cùng phòng ban có thể duyệt cấp 1. TEAM_LEAD: Manager cùng phòng ban. Đơn trên 1 ngày chuyển `APPROVED_BY_LEAD`, rồi Director duyệt; đơn tối đa 1 ngày chuyển thẳng `WAITING_FOR_DOC`. Manager/Accountant do Director duyệt trực tiếp. Không cho Director tự tạo/duyệt đơn nghỉ.
- Duyệt/từ chối sử dụng transaction và `SELECT ... FOR UPDATE`, ghi trạng thái cùng `approval_history`.
- Chủ đơn và người trong phạm vi quản lý có thể xem chi tiết; danh sách `/leave` hiện chỉ lấy đơn của chính người dùng.
- **Thiếu:** upload chứng từ, bước chuyển `WAITING_FOR_DOC` → `COMPLETED`, thông báo cho nhân viên.

### Đơn ra ngoài

- Server xác thực dữ liệu, tự tính giờ; đơn phải cùng một ngày và giờ kết thúc sau giờ bắt đầu.
- Trạng thái `PENDING → APPROVED → COMPLETED`, hoặc `REJECTED`. APPROVED cho phép ra ngoài; bước hoàn tất được thực hiện bằng cùng action duyệt, ở lần thao tác thứ hai.
- Theo code, chỉ ACCOUNTANT/DIRECTOR có thể duyệt hoặc xác nhận hoàn tất; từ chối bắt buộc lý do.
- Duyệt/từ chối dùng transaction và khóa dòng.

### Dashboard và giao diện

Dashboard hiển thị thống kê đơn **cá nhân**, hoạt động gần đây của cá nhân và một phần hàng đợi cần duyệt. Không thấy các báo cáo/biểu đồ hay bộ lọc toàn công ty/phòng ban như mô tả mục tiêu README.

## 4. Phát hiện và rủi ro

### P1 — Cần xử lý trước production

**P1.1 — Rò thông tin lỗi nội bộ ra client.** Các catch trong action duyệt/từ chối trả chuỗi nối `err.message` về người dùng. Tùy driver/lỗi, nội dung có thể lộ mã lỗi và chi tiết nội bộ. Hãy trả thông báo chung cho client, log phía server với mã tương quan; không trả nguyên lỗi.

**P1.2 — Trùng đơn do race condition.** Hai request cùng người có thể cùng vượt qua SELECT kiểm tra trùng trước khi một request INSERT. Kiểm tra overlap nghỉ phép và ra ngoài hiện nằm ngoài transaction/không có DB constraint tương ứng. Nên dùng transaction với khóa thích hợp và/hoặc PostgreSQL exclusion constraint/constraint thiết kế phù hợp; vẫn cần trả lỗi thân thiện khi constraint vi phạm.

**P1.3 — Tài khoản mẫu và seed không an toàn nếu chạy production.** `scripts/seed-auth-data.js` đặt mật khẩu mẫu chung `123456`, cập nhật password của các email mẫu khi chạy và tạo user bị khóa. Tách seed dev/test khỏi production, chặn bằng cờ môi trường rõ ràng, không in credential; bắt buộc đặt mật khẩu riêng mạnh trước khi mở ứng dụng.

**P1.4 — Không có rate-limit đăng nhập.** `loginAction()` không thấy giới hạn theo tài khoản/IP, backoff hay khóa tạm sau nhiều lần thất bại. Thêm rate limiting, ghi nhận sự kiện đăng nhập, và giữ thông báo thất bại chung để giảm dò tài khoản. Hiện thông báo cho tài khoản bị khóa khác thông báo sai mật khẩu, có thể tiết lộ trạng thái tài khoản.

**P1.5 — Thiếu luồng chứng từ nghỉ phép.** Cơ sở dữ liệu có `document_url`, nhưng không có action/component lưu file hay endpoint/URL xác thực. Đơn không thể đi tới COMPLETED bằng ứng dụng, trái với mục tiêu quy trình. Nếu triển khai upload, cần private storage, giới hạn MIME/kích thước, xác minh nội dung file, kiểm tra quyền và trạng thái ở server; không lưu public URL mở.

### P2 — Lệch chính sách / thiếu chức năng cần chốt

**P2.1 — Quyền duyệt đơn ra ngoài lệch tài liệu.** README mô tả `manager_id`, Team Lead cùng team hoặc Manager cùng phòng ban; code chỉ chấp nhận ACCOUNTANT/DIRECTOR. `manager_id` không được dùng trong `evaluateOutOfficeApproval()`. Cần xác nhận một ma trận chính thức rồi đồng bộ README, workflow, hàng đợi, sidebar và tests.

**P2.2 — Ý nghĩa số ngày nghỉ không đồng nhất.** README nói số ngày lịch, không loại cuối tuần/ngày lễ (`README.md:91-95`), trong khi code loại Chủ Nhật và gọi là ngày làm việc. Thứ Bảy vẫn tính là ngày làm việc, ngày lễ không bị trừ. Cần chốt chính sách lao động (thứ Bảy, Chủ Nhật, lễ, nửa ngày) và đồng bộ calculator/UI/tài liệu.

**P2.3 — DIRECTOR/ACCOUNTANT chưa có danh sách duyệt/xem toàn bộ lịch sử theo đặc tả.** `getMyLeaveRequests()` và `getMyOutOfficeRequests()` luôn lọc `employee_id = userId`; do đó list route chỉ ra đơn cá nhân. Director có quyền vào chi tiết khi biết ID và có thể có hàng đợi, nhưng không có trang duyệt/xem toàn công ty như mô tả README. Accountant cũng không có danh sách toàn công ty để đối soát; chỉ có queue đơn đang chờ và chi tiết nếu mở được ID.

**P2.4 — “Quản lý trực tiếp” chưa được dùng trong phân quyền.** `canAccessUserData()` dựa vai trò + team/phòng ban; không dùng quan hệ `manager_id`. Nếu chính sách dựa quản lý trực tiếp, quyền xem/duyệt cần đối chiếu cả trường này và trường hợp thiếu/cấu hình sai.

**P2.5 — Dashboard báo cáo hạn chế.** Chưa có tổng hợp theo phòng ban, khoảng ngày, số ngày/giờ, hoặc báo cáo chấm công; hiện chỉ có thống kê cá nhân và số việc cần xử lý.

### P2 — Kiểm soát dữ liệu và vận hành

- Ngày đầu vào chỉ được kiểm tra regex dạng `YYYY-MM-DD`; chưa xác nhận ngày lịch thực sự tồn tại hoặc chính sách ngày quá khứ/tương lai. Out-office form còn mặc định ngày bằng `new Date().toISOString().split('T')[0]`, có thể hiện ngày UTC thay vì ngày địa phương (vấn đề quanh nửa đêm theo múi giờ).
- `reason` kiểm tra `.min(5)` nhưng không trim trước; chuỗi toàn khoảng trắng có thể qua validation. Nên normalize/trim ở server.
- Session cố định 7 ngày, chưa thấy gia hạn trượt, thu hồi mọi session sau đổi mật khẩu hoặc chính sách quản lý phiên thiết bị. Đây là cải tiến hardening, không khẳng định có lỗ hổng session cụ thể.
- `approval_history` lưu action và comment nhưng không có status_before/status_after như mô tả tài liệu; bảng dùng `request_id` không có FK đa hình tới hai bảng request. Cần quy định tính toàn vẹn, chỉ mục theo `(request_type, request_id, created_at)` và retention.
- `lib/db/pool.ts` ghi nguyên nội dung query SQL vào log server khi DB lỗi. Hiện query parameter không in ra, nhưng cần tránh để dữ liệu nhạy cảm đi vào câu SQL nội suy; cân nhắc log tên truy vấn/mã lỗi thay vì SQL nguyên văn.
- Thiếu phân trang cho danh sách/queue; dashboard lấy pending lists chỉ để đếm rồi lại lấy lại từ page, tạo truy vấn trùng. Khi dữ liệu lớn, dùng COUNT ở DB, pagination và query có giới hạn.
- Chưa thấy audit log chung cho tạo/đăng nhập thất bại/đổi trạng thái, quản trị role, cấu hình quyền.

### P3 — Kiểm thử và chất lượng dự án

- `package.json` không khai báo Vitest/Jest/Playwright; `npm run lint` gọi `next lint` nhưng dependencies không liệt kê ESLint. Cần kiểm chứng script này trong môi trường build thực tế.
- `scripts/test-phase2.js`, `test-phase3.js`, `test-phase4.js` là script thủ công có kết nối database. Phase 3/4 tự viết bản sao logic thay vì import code production; một số kiểm tra chỉ assertion hằng (ví dụ concurrency/build check), không thực thi race thật hoặc compiler.
- Các script test đọc `.env`/`.env.local`, gọi database và có thể thêm/xóa/cập nhật dữ liệu. Không nên chạy trên DB thật nếu chưa xác định target và dữ liệu; cần chuyển sang DB test cô lập/transaction rollback.
- Chưa chạy test hay build trong lần rà soát. Lệnh TypeScript bị vướng giới hạn PowerShell/runtime của thiết bị, nên **chưa xác nhận được trạng thái compile**.
- Chưa xác minh được trạng thái Git/tracked files do Git CLI không khả dụng trong terminal hiện tại. `.gitignore` có loại `.env`; điều đó không chứng minh `.env` chưa từng được commit. Nên kiểm tra lịch sử Git ở máy có Git và rotate credential nếu từng lộ.

## 5. Điểm đang làm tốt

- Tách auth, query, workflow, tính toán và UI tương đối rõ; luồng chính có thể lần theo.
- Danh tính tạo đơn lấy từ session; không tin `employee_id`/role từ form.
- Query DB phần lớn sử dụng parameter binding.
- Cookie session có `HttpOnly`, `SameSite=Lax`; session ID sinh từ bộ tạo số ngẫu nhiên mật mã và lưu server-side.
- Tài khoản bị vô hiệu hóa được chặn ở bước login và khi nạp current user.
- Quyết định approve/reject của cả hai nghiệp vụ dùng cùng một DB transaction với cập nhật trạng thái và history; khóa `FOR UPDATE` giúp tuần tự hóa các lần xử lý trên cùng request.
- Workflow cấm tự duyệt và kiểm tra trạng thái trước khi cho phép chuyển tiếp.
- Không đọc nội dung `.env` trong quá trình đánh giá này.

## 6. Thứ tự khắc phục đề xuất

1. **Bảo mật ngay:** loại bỏ `err.message` khỏi phản hồi action; thêm rate-limit đăng nhập; vô hiệu hóa seed/sample credentials trên production; xác minh/rotate secrets nếu từng commit.
2. **Chốt nghiệp vụ:** xác nhận matrix duyệt out-office, ý nghĩa ngày nghỉ, quyền Accountant/Director và phạm vi `manager_id`.
3. **Tính toàn vẹn:** chống overlap đồng thời ở PostgreSQL; validate ngày hợp lệ, ngày quá khứ, trim input, giới hạn độ dài/khung giờ.
4. **Hoàn tất quy trình:** xây upload riêng tư và action hoàn tất có kiểm tra trạng thái/quyền; hoặc bỏ trạng thái/mô tả upload khỏi scope nếu chưa làm.
5. **Phân quyền và báo cáo:** thiết kế danh sách toàn công ty cho role được phép, dùng query có scope rõ ràng, pagination, filter thời gian/phòng ban và aggregate dashboard.
6. **Kiểm thử:** chuyển logic dùng chung thành unit tests gọi trực tiếp module production; integration tests với PostgreSQL cô lập; E2E login/role/overlap/workflow; concurrency test thật; CI chạy `tsc`, lint, build.
7. **Vận hành:** cấu hình DB role least privilege, backup/restore, log/audit, monitoring, quản lý session và checklist deployment.

## 7. Những nội dung chưa xác minh

- Không kết nối PostgreSQL nên chưa biết schema thực tế có khớp migrations, dữ liệu/role hiện có và constraint/index nào.
- Không chạy seed/test/build và không kiểm tra runtime/deploy/browser.
- Không xác định nội dung hay độ an toàn của giá trị `.env`; không thực hiện Git history scan.
- Do đó các kết luận là phân tích source code tại chỗ, cần đối chiếu cấu hình/schema thật trước khi đưa ra quyết định production.
