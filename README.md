# Leave & Gate Pass Management System

Hệ thống web nội bộ quản lý **nghỉ phép** và **đăng ký ra ngoài** cho doanh nghiệp, với quy trình phê duyệt nhiều cấp, phân quyền chặt chẽ theo vai trò / phòng ban / team, và dashboard phục vụ đối soát chấm công.

> Trạng thái: **Giai đoạn 1 – Phân tích và nền tảng.** Tài liệu này mô tả tổng quan; các mục đánh dấu *(giả định)* cần được doanh nghiệp xác nhận trước khi đưa vào production.

---

## 1. Mục tiêu

- Nhân viên đăng nhập, tạo đơn nghỉ phép và đơn xin ra ngoài.
- Quản lý duyệt / từ chối đơn đúng vai trò, phòng ban, team và cấp duyệt.
- Nhân viên tải ảnh giấy nghỉ phép đã ký để hoàn tất đơn.
- Kế toán theo dõi dữ liệu phục vụ đối soát chấm công.
- Giám đốc giám sát và duyệt các đơn thuộc thẩm quyền.
- Dashboard thống kê ngày nghỉ, giờ ra ngoài, trạng thái đơn theo phòng ban.
- Mọi thao tác nhạy cảm đều được xác thực và phân quyền **ở phía máy chủ**.

## 2. Công nghệ

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| UI | Tailwind CSS, shadcn/ui, Lucide React, Framer Motion |
| Backend | Server Actions + Route Handlers (chỉ chạy phía server) |
| Database | PostgreSQL hiện có (quản lý bằng DBeaver), truy cập qua `pg` + connection pool |
| Xác thực | Session do ứng dụng quản lý; băm mật khẩu bằng Argon2id hoặc bcrypt |
| File | Giấy nghỉ phép PDF/PNG/JPEG (tối đa 5 MiB) lưu riêng tư dạng PostgreSQL `BYTEA`; tải qua route xác thực |
| Biểu đồ | Recharts |
| Form & validation | React Hook Form + Zod (client và server) |
| Kiểm thử | Vitest/Jest (unit), Playwright (E2E) |

Không dùng Supabase, không có `auth.uid()`. DBeaver chỉ là công cụ quản trị database, không phải backend.

## 3. Vai trò người dùng

| Vai trò | Phạm vi xem dữ liệu | Quyền duyệt |
|---|---|---|
| `STAFF` | Chỉ dữ liệu của chính mình | Không |
| `TEAM_LEAD` | Bản thân + cùng `team_id` | Cấp 1 trong team được giao |
| `MANAGER` | Bản thân + cùng `department_id` | Cấp 1 trong phòng ban, theo ma trận |
| `ACCOUNTANT` | Toàn công ty (giám sát, đối soát) | Không mặc nhiên |
| `DIRECTOR` | Toàn công ty | Các đơn yêu cầu cấp Director |

Không ai được duyệt đơn của chính mình.

## 4. Quy trình đơn nghỉ phép

Trạng thái: `PENDING` → `APPROVED_BY_LEAD` → `WAITING_FOR_DOC` → `COMPLETED` (hoặc `REJECTED`).

| Người xin nghỉ | ≤ 1 ngày | ≥ 2 ngày |
|---|---|---|
| STAFF | Manager cùng phòng duyệt → `WAITING_FOR_DOC` | Manager duyệt cấp 1 → `APPROVED_BY_LEAD` → Director duyệt → `WAITING_FOR_DOC` |
| TEAM_LEAD | Manager cùng phòng duyệt → `WAITING_FOR_DOC` | Manager duyệt cấp 1 → `APPROVED_BY_LEAD` → Director duyệt → `WAITING_FOR_DOC` |
| MANAGER | Director duyệt trực tiếp → `WAITING_FOR_DOC` | Director duyệt trực tiếp → `WAITING_FOR_DOC` |
| ACCOUNTANT | Chỉ xem báo cáo tổng hợp; không tạo/xem chi tiết đơn và không duyệt | Chỉ xem báo cáo tổng hợp; không tạo/xem chi tiết đơn và không duyệt |
| DIRECTOR | Mặc định **từ chối tự duyệt**; cần quy trình ngoài hệ thống do doanh nghiệp xác định | |

**Hoàn tất bằng giấy đã ký:** khi đơn ở `WAITING_FOR_DOC`, chỉ chủ đơn mới được tải PDF/PNG/JPEG (tối đa 5 MiB). Server kiểm tra session, chủ đơn, trạng thái, MIME và chữ ký định dạng; lưu tệp và chuyển sang `COMPLETED` trong cùng transaction. Tải xuống qua route xác thực và kiểm tra scope; tệp không nằm trong thư mục public. Client không thể tự đặt `status = COMPLETED`.

> Để bật tính năng, chạy migration `migrations/03_leave_documents.sql` sau migrations `01` và `02` trên PostgreSQL trước khi deploy phiên bản này.

## 5. Quy trình đơn xin ra ngoài

`PENDING` → `APPROVED` hoặc `REJECTED`. (`COMPLETED` dành cho bước đối soát sau này.)

- Người duyệt: Manager duyệt đơn của STAFF/TEAM_LEAD cùng phòng ban; Director có quyền duyệt toàn công ty. Team Lead không duyệt. ACCOUNTANT chỉ xem báo cáo tổng hợp.
- Chỉ trong cùng một ngày; giờ kết thúc phải lớn hơn giờ bắt đầu.
- `estimated_hours` do **server** tự tính, không tin dữ liệu từ client.
- Từ chối bắt buộc có lý do. `APPROVED` không đồng nghĩa `COMPLETED`.

## 6. Cơ sở dữ liệu hiện có

Giữ nguyên tên bảng, cột, kiểu dữ liệu gốc; không tự ý sửa.

| Bảng | Cột chính |
|---|---|
| `departments` | `id`, `name` |
| `teams` | `id`, `department_id`, `name` |
| `users` | `id`, `email`, `full_name`, `role`, `department_id`, `team_id`, `manager_id` |
| `leave_requests` | `id`, `employee_id`, `start_date`, `end_date`, `duration_days`, `reason`, `status`, `document_url`, `approver_id`, `rejection_reason` |
| `out_office_requests` | `id`, `employee_id`, `request_date`, `start_time`, `end_time`, `estimated_hours`, `reason_type`, `reason`, `status`, `approver_id`, `rejection_reason` |

### Migration cần bổ sung (file riêng, không sửa bảng gốc)

1. **Thông tin đăng nhập:** `users` chưa có cột mật khẩu → thêm `password_hash` hoặc tạo bảng xác thực riêng.
2. **`approval_history`:** lưu từng quyết định duyệt/từ chối (loại đơn, `request_id`, `approver_id`, `action`, trạng thái trước/sau, lý do, `created_at`). Một `approver_id` duy nhất không đủ để lưu lịch sử nhiều cấp.
3. **`audit_logs`** *(nếu cần)*: ghi thao tác nhạy cảm, không lưu mật khẩu/token.

Nếu chưa có quyền sửa database, hệ thống chạy ở chế độ tương thích schema hiện tại với các hạn chế đã nêu.

## 7. Giả định ban đầu

Cần doanh nghiệp xác nhận trước production:

- *(giả định)* Số ngày nghỉ = số ngày lịch, **gồm cả** ngày bắt đầu và kết thúc; không loại trừ cuối tuần/ngày lễ; không nghỉ nửa ngày; không nghỉ theo giờ.
- *(giả định)* Không cho tạo đơn trùng khoảng thời gian của cùng một nhân viên.
- *(giả định)* Giới hạn giờ làm việc và số giờ ra ngoài tối đa cấu hình được theo chính sách.
- Khi `manager_id`, `team_id` hoặc `department_id` không đủ xác định người duyệt → từ chối thao tác và ghi nhận lỗi cấu hình.
- Quyền xem ảnh giấy nghỉ phép của ACCOUNTANT cần được xác định riêng.

## 8. Bảo mật

- Mọi Server Action xác minh session phía server; danh tính lấy từ session, hồ sơ và quyền đọc từ bảng `users`.
- Không tin `role`, `employee_id`, `approver_id`, `department_id`, `team_id`, `status`, `duration_days`, `estimated_hours` do client gửi.
- Duyệt/từ chối dùng transaction (`BEGIN/COMMIT/ROLLBACK` trên cùng một client của pool) hoặc cập nhật có điều kiện trạng thái để chống race condition.
- Role PostgreSQL riêng cho ứng dụng với quyền tối thiểu, không dùng superuser, không mở cổng DB công khai.
- RLS chỉ triển khai nếu thiết lập context người dùng theo transaction an toàn và đã kiểm thử rò rỉ giữa các request.
- File riêng tư; truy cập qua signed URL có thời hạn hoặc endpoint đã xác thực sau khi kiểm tra quyền.
- Không trả stack trace, lỗi SQL, secret cho client; ẩn nút trên giao diện **không** phải biện pháp bảo mật.

## 9. Cấu trúc thư mục dự kiến

```
types/index.ts
lib/
  db/            pool.ts, queries.ts
  auth/          session.ts
  actions/       leave-actions.ts, out-office-actions.ts
  queries/       dashboard.ts
  validators/    leave.ts, out-office.ts
  permissions/   approval-rules.ts
components/
  dashboard/     leave-chart.tsx, out-office-chart.tsx
  leave/         leave-form.tsx, leave-list.tsx, leave-document-upload.tsx
  out-office/    out-office-form.tsx, out-office-list.tsx
  approvals/     approval-list.tsx, approval-actions.tsx
app/
  (auth)/login/
  (dashboard)/   dashboard, leave, out-office, approvals, reports
migrations/
tests/           unit/, e2e/
```

## 10. Lộ trình

| Giai đoạn | Nội dung |
|---|---|
| 1 | Phân tích, giả định, `types/index.ts`, `lib/actions/leave-actions.ts` |
| 2 | Migration, kết nối `pg`, DB role, session/auth, lưu file riêng tư, kiểm thử quyền & transaction |
| 3 | Đơn ra ngoài: types, validation, actions, kiểm thử tính giờ |
| 4 | Query có phân quyền, aggregate, Recharts, bộ lọc ngày/tuần/tháng/phòng ban |
| 5 | Giao diện: đăng nhập, dashboard, form, danh sách, duyệt, upload, báo cáo |
| 6 | TypeScript check, lint, unit/E2E, kiểm thử bảo mật, hướng dẫn deploy & checklist |

## 11. Kiểm thử trọng tâm

- **Nghỉ phép:** từng nhánh của ma trận duyệt, tự duyệt, duyệt ngoài phạm vi, sai trạng thái, hai người duyệt đồng thời, từ chối thiếu lý do, upload thất bại, upload xong nhưng cập nhật DB lỗi.
- **Ra ngoài:** giờ hợp lệ/không hợp lệ, không đủ quyền, tự duyệt, đơn đã xử lý, từ chối thiếu lý do, đọc đơn ngoài phạm vi.
- **Phân quyền:** STAFF/TEAM_LEAD/MANAGER không đọc vượt phạm vi; ACCOUNTANT chỉ xem; DIRECTOR xem toàn công ty; không nâng quyền bằng cách sửa request.

## 12. Biến môi trường (dự kiến)

```env
DATABASE_URL=postgresql://app_user:***@host:5432/dbname
SESSION_SECRET=***            # chuỗi ngẫu nhiên dài, chỉ dùng phía server
FILE_STORAGE_PATH=***         # hoặc cấu hình object storage
```

Không commit file `.env`; không đưa bất kỳ secret nào vào code client.

## 13. Kiểm tra schema thực tế

Trước khi viết code, chạy trong DBeaver để xác minh cột, khóa ngoại, constraint và index (không gửi mật khẩu hay secret):

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('departments','teams','users','leave_requests','out_office_requests')
ORDER BY table_name, ordinal_position;
```
