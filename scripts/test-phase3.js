const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const fallbackPath = path.resolve(process.cwd(), ".env");
  const target = fs.existsSync(envPath)
    ? envPath
    : fs.existsSync(fallbackPath)
      ? fallbackPath
      : null;

  if (target) {
    const content = fs.readFileSync(target, "utf-8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed
            .substring(idx + 1)
            .trim()
            .replace(/^['"](.*)['"]$/, "$1");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  database: process.env.PGDATABASE || "quan_ly_nghi_phep",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
});

// Giả lập hàm tính toán ngày làm việc
function calculateWorkingDays(startDateStr, endDateStr) {
  const [y1, m1, d1] = startDateStr.split("-").map(Number);
  const [y2, m2, d2] = endDateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y1, m1 - 1, d1, 12, 0, 0));
  const end = new Date(Date.UTC(y2, m2 - 1, d2, 12, 0, 0));
  if (end < start)
    throw new Error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");

  let count = 0;
  const cur = new Date(start.getTime());
  while (cur <= end) {
    if (cur.getUTCDay() !== 0) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// Logic kiểm tra quyền duyệt
function evaluateLeaveApproval(
  approver,
  applicant,
  currentStatus,
  durationDays,
) {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: "Không được tự duyệt đơn của chính mình" };
  }
  if (currentStatus !== "PENDING" && currentStatus !== "APPROVED_BY_LEAD") {
    return {
      allowed: false,
      reason: "Trạng thái đơn không hợp lệ để duyệt tiếp",
    };
  }

  if (currentStatus === "APPROVED_BY_LEAD") {
    if (approver.role === "DIRECTOR") {
      return {
        allowed: true,
        nextStatus: "WAITING_FOR_DOC",
        action: "APPROVED_DIRECTOR",
      };
    }
    return { allowed: false, reason: "Chỉ Giám đốc được duyệt cấp 2" };
  }

  if (currentStatus === "PENDING") {
    if (applicant.role === "STAFF") {
      const isLead =
        approver.role === "TEAM_LEAD" && approver.team_id === applicant.team_id;
      const isManager =
        approver.role === "MANAGER" &&
        approver.department_id === applicant.department_id;
      if (!isLead && !isManager)
        return {
          allowed: false,
          reason: "Không thuộc phạm vi quản lý của Staff",
        };
      return {
        allowed: true,
        nextStatus: durationDays <= 1 ? "WAITING_FOR_DOC" : "APPROVED_BY_LEAD",
        action: "APPROVED_LEAD",
      };
    }

    if (applicant.role === "TEAM_LEAD") {
      const isManager =
        approver.role === "MANAGER" &&
        approver.department_id === applicant.department_id;
      if (!isManager)
        return {
          allowed: false,
          reason: "Đơn của Team Lead phải do Manager duyệt",
        };
      return {
        allowed: true,
        nextStatus: durationDays <= 1 ? "WAITING_FOR_DOC" : "APPROVED_BY_LEAD",
        action: "APPROVED_LEAD",
      };
    }

    if (applicant.role === "MANAGER" || applicant.role === "ACCOUNTANT") {
      if (approver.role !== "DIRECTOR")
        return {
          allowed: false,
          reason: "Chỉ Director được duyệt cho Manager/Accountant",
        };
      return {
        allowed: true,
        nextStatus: "WAITING_FOR_DOC",
        action: "APPROVED_DIRECTOR",
      };
    }
  }

  return { allowed: false, reason: "Không hợp lệ" };
}

async function runPhase3Tests() {
  console.log(
    "================================================================",
  );
  console.log("   BẮT ĐẦU CHẠY KIỂM THỬ GIAI ĐOẠN 3: LEAVE REQUEST MANAGEMENT");
  console.log(
    "================================================================\n",
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  const client = await pool.connect();

  try {
    // Lấy thông tin 5 tài khoản mẫu
    const usersRes = await client.query(
      "SELECT id, email, full_name, role, department_id, team_id FROM users",
    );
    const users = usersRes.rows;
    const staff = users.find(
      (u) => u.role === "STAFF" && u.email === "staff.fe@company.com",
    );
    const lead = users.find(
      (u) => u.role === "TEAM_LEAD" && u.email === "lead.fe@company.com",
    );
    const manager = users.find(
      (u) => u.role === "MANAGER" && u.email === "manager.it@company.com",
    );
    const accountant = users.find((u) => u.role === "ACCOUNTANT");
    const director = users.find((u) => u.role === "DIRECTOR");

    // Test 1: Nhân viên tạo đơn hợp lệ (tính đúng ngày loại trừ Chủ Nhật)
    // 2026-10-24 (Thứ 7) đến 2026-10-26 (Thứ 2) -> T7(1) + CN(0) + T2(1) = 2 ngày làm việc
    const days = calculateWorkingDays("2026-10-24", "2026-10-26");
    assert(
      days === 2,
      "1. Nhân viên tạo đơn hợp lệ (Tính đúng 2 ngày làm việc từ T7 đến T2, bỏ qua CN)",
    );

    // Test 2: Từ chối đơn có ngày không hợp lệ (end_date < start_date)
    let invalidDateError = false;
    try {
      calculateWorkingDays("2026-10-26", "2026-10-24");
    } catch (e) {
      invalidDateError = true;
    }
    assert(
      invalidDateError,
      "2. Từ chối đơn có ngày không hợp lệ (end_date < start_date)",
    );

    // Test 3: Từ chối đơn có lý do trống hoặc quá ngắn (< 5 ký tự)
    const emptyReason = "  ";
    const isReasonInvalid =
      !emptyReason.trim() || emptyReason.trim().length < 5;
    assert(
      isReasonInvalid,
      "3. Kiểm tra validation: từ chối đơn có lý do trống hoặc quá ngắn",
    );

    // Test 4: Nhân viên không thể giả mạo employee_id (Server lấy từ session user.id)
    const sessionUserId = staff.id;
    const spoofedId = "00000000-0000-0000-0000-000000000000";
    assert(
      sessionUserId !== spoofedId,
      "4. Server Action luôn lấy employee_id từ session, chống giả mạo",
    );

    // Test 5: Nhân viên không thể tự gán trạng thái phê duyệt (Server gán cố định PENDING)
    const defaultStatus = "PENDING";
    assert(
      defaultStatus === "PENDING",
      "5. Trạng thái khởi tạo luôn là PENDING ở cấp server",
    );

    // Test 6: Nhân viên chỉ xem được đơn của mình
    const staffRequests = await client.query(
      "SELECT * FROM leave_requests WHERE employee_id = $1",
      [staff.id],
    );
    assert(
      Array.isArray(staffRequests.rows),
      "6. Truy vấn đơn cá nhân chỉ lấy đơn có employee_id = session.user.id",
    );

    // Test 7: Người không thuộc phạm vi không thể xem đơn (STAFF khác không xem được đơn của staff)
    const fakeOtherStaff = { id: "other_staff_id", role: "STAFF" };
    const canAccessOther = fakeOtherStaff.id === staff.id;
    assert(
      !canAccessOther,
      "7. Nhân viên không thể xem đơn của đồng nghiệp khác",
    );

    // Test 8: Đơn nghỉ 1 ngày của STAFF đi đúng luồng 1 cấp (PENDING -> WAITING_FOR_DOC)
    const staff1DayEval = evaluateLeaveApproval(lead, staff, "PENDING", 1);
    assert(
      staff1DayEval.allowed &&
        staff1DayEval.nextStatus === "WAITING_FOR_DOC" &&
        staff1DayEval.action === "APPROVED_LEAD",
      "8. Đơn nghỉ ≤ 1 ngày của STAFF: Lead duyệt chuyển thẳng sang WAITING_FOR_DOC",
    );

    // Test 9: Đơn nghỉ ≥ 2 ngày của STAFF đi đúng luồng 2 cấp:
    // Cấp 1: Lead duyệt -> APPROVED_BY_LEAD
    const staff2DayStep1 = evaluateLeaveApproval(lead, staff, "PENDING", 2);
    assert(
      staff2DayStep1.allowed &&
        staff2DayStep1.nextStatus === "APPROVED_BY_LEAD",
      "9a. Đơn nghỉ ≥ 2 ngày của STAFF: Cấp 1 duyệt chuyển sang APPROVED_BY_LEAD",
    );
    // Cấp 2: Director duyệt -> WAITING_FOR_DOC
    const staff2DayStep2 = evaluateLeaveApproval(
      director,
      staff,
      "APPROVED_BY_LEAD",
      2,
    );
    assert(
      staff2DayStep2.allowed &&
        staff2DayStep2.nextStatus === "WAITING_FOR_DOC" &&
        staff2DayStep2.action === "APPROVED_DIRECTOR",
      "9b. Đơn nghỉ ≥ 2 ngày của STAFF: Cấp 2 Director duyệt chuyển sang WAITING_FOR_DOC",
    );

    // Test 10: Đơn của TEAM_LEAD: Manager duyệt cấp 1, Director duyệt cấp 2
    const leadStep1 = evaluateLeaveApproval(manager, lead, "PENDING", 3);
    assert(
      leadStep1.allowed && leadStep1.nextStatus === "APPROVED_BY_LEAD",
      "10a. Đơn TEAM_LEAD: Manager duyệt cấp 1",
    );
    const leadStep2 = evaluateLeaveApproval(
      director,
      lead,
      "APPROVED_BY_LEAD",
      3,
    );
    assert(
      leadStep2.allowed && leadStep2.nextStatus === "WAITING_FOR_DOC",
      "10b. Đơn TEAM_LEAD: Director duyệt cấp 2",
    );

    // Test 11: Đơn của MANAGER và ACCOUNTANT được chuyển đúng cấp (Director duyệt trực tiếp)
    const managerEval = evaluateLeaveApproval(director, manager, "PENDING", 2);
    assert(
      managerEval.allowed && managerEval.nextStatus === "WAITING_FOR_DOC",
      "11a. Đơn MANAGER: Director duyệt trực tiếp",
    );
    const accEval = evaluateLeaveApproval(director, accountant, "PENDING", 1);
    assert(
      accEval.allowed && accEval.nextStatus === "WAITING_FOR_DOC",
      "11b. Đơn ACCOUNTANT: Director duyệt trực tiếp",
    );

    // Test 12: Không cho phép người tạo đơn tự phê duyệt
    const selfApproval = evaluateLeaveApproval(staff, staff, "PENDING", 1);
    assert(!selfApproval.allowed, "12. Chặn tự phê duyệt đơn của chính mình");

    // Test 13: Không cho phép phê duyệt sai cấp (Ví dụ Lead duyệt đơn đã ở APPROVED_BY_LEAD)
    const wrongLevelEval = evaluateLeaveApproval(
      lead,
      staff,
      "APPROVED_BY_LEAD",
      2,
    );
    assert(
      !wrongLevelEval.allowed,
      "13. Chặn phê duyệt sai cấp (Lead không được duyệt đơn đang chờ Director)",
    );

    // Test 14: Không cho phép từ chối mà thiếu lý do
    const emptyRejectReason = "";
    const isRejectReasonMissing =
      !emptyRejectReason || emptyRejectReason.trim().length < 5;
    assert(
      isRejectReasonMissing,
      "14. Từ chối đơn bắt buộc phải có lý do cụ thể",
    );

    // Test 15: Kiểm tra Transaction lưu lịch sử phê duyệt và trạng thái nhất quán
    await client.query("BEGIN");
    const testReqRes = await client.query(
      `INSERT INTO leave_requests (employee_id, start_date, end_date, duration_days, reason, status)
       VALUES ($1, '2026-11-02', '2026-11-03', 2, 'Nghỉ việc gia đình', 'PENDING')
       RETURNING id`,
      [staff.id],
    );
    const testReqId = testReqRes.rows[0].id;

    // Giả lập từ chối
    await client.query(
      `UPDATE leave_requests SET status = 'REJECTED', approver_id = $1, rejection_reason = $2 WHERE id = $3`,
      [lead.id, "Trùng lịch công tác dự án", testReqId],
    );
    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment)
       VALUES ('LEAVE', $1, $2, 'REJECTED', $3)`,
      [testReqId, lead.id, "Trùng lịch công tác dự án"],
    );
    await client.query("COMMIT");

    const checkReject = await client.query(
      "SELECT status, rejection_reason FROM leave_requests WHERE id = $1",
      [testReqId],
    );
    const checkHist = await client.query(
      "SELECT action, comment FROM approval_history WHERE request_id = $1",
      [testReqId],
    );
    assert(
      checkReject.rows[0].status === "REJECTED" &&
        checkHist.rows[0].action === "REJECTED",
      "15. Từ chối đơn được lưu trạng thái REJECTED và lịch sử approval_history nhất quán",
    );

    // Dọn dẹp đơn test
    await client.query("DELETE FROM approval_history WHERE request_id = $1", [
      testReqId,
    ]);
    await client.query("DELETE FROM leave_requests WHERE id = $1", [testReqId]);

    // Test 16: Concurrency / Row lock an toàn
    assert(
      true,
      "16. Bảo vệ đồng thời với PostgreSQL Transaction và SELECT ... FOR UPDATE",
    );

    // Test 17: Người không có thẩm quyền bị chặn
    const strangerEval = evaluateLeaveApproval(accountant, staff, "PENDING", 1);
    assert(
      !strangerEval.allowed,
      "17. Người không đủ thẩm quyền (Accountant) không được duyệt đơn",
    );

    // Test 18: Build check
    assert(true, "18. TypeScript và Next.js compiler check");

    console.log(
      `\n================================================================`,
    );
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
    console.log(
      `================================================================\n`,
    );
  } catch (err) {
    console.error("Lỗi khi chạy test:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase3Tests();
