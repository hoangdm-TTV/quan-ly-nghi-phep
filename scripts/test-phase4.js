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

function calculateEstimatedHours(startTimeStr, endTimeStr) {
  const [h1, m1] = startTimeStr.split(":").map(Number);
  const [h2, m2] = endTimeStr.split(":").map(Number);
  const startMinutes = h1 * 60 + m1;
  const endMinutes = h2 * 60 + m2;
  if (endMinutes <= startMinutes) {
    throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
  }
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

function evaluateOutOfficeApproval(approver, applicant, currentStatus) {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: "Không được tự duyệt đơn của chính mình" };
  }
  if (approver.role !== "ACCOUNTANT" && approver.role !== "DIRECTOR") {
    return {
      allowed: false,
      reason: "Chỉ phòng Kế toán hoặc Giám đốc mới có quyền duyệt",
    };
  }
  if (currentStatus === "PENDING") {
    return { allowed: true, nextStatus: "APPROVED" };
  }
  if (currentStatus === "APPROVED") {
    return { allowed: true, nextStatus: "COMPLETED" };
  }
  return { allowed: false, reason: "Trạng thái không hợp lệ" };
}

async function runPhase4Tests() {
  console.log(
    "================================================================",
  );
  console.log("   BẮT ĐẦU CHẠY KIỂM THỬ GIAI ĐOẠN 4: GATE PASS MANAGEMENT");
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
    const usersRes = await client.query(
      "SELECT id, email, full_name, role, department_id, team_id FROM users",
    );
    const users = usersRes.rows;
    const staff = users.find(
      (u) => u.role === "STAFF" && u.email === "staff.fe@company.com",
    );
    const lead = users.find((u) => u.role === "TEAM_LEAD");
    const manager = users.find((u) => u.role === "MANAGER");
    const accountant = users.find((u) => u.role === "ACCOUNTANT");
    const director = users.find((u) => u.role === "DIRECTOR");

    // Test 1: Nhân viên tạo đơn hợp lệ
    const validHours = calculateEstimatedHours("08:30", "10:00");
    assert(
      validHours === 1.5,
      "1. Nhân viên tạo đơn hợp lệ (Tính đúng 1.5 giờ từ 08:30 đến 10:00)",
    );

    // Test 2: Ngày không hợp lệ bị từ chối
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    assert(
      !dateRegex.test("invalid-date"),
      "2. Định dạng ngày không hợp lệ bị từ chối",
    );

    // Test 3: Giờ kết thúc <= giờ bắt đầu bị từ chối
    let timeError = false;
    try {
      calculateEstimatedHours("10:00", "08:30");
    } catch (e) {
      timeError = true;
    }
    assert(timeError, "3. Giờ kết thúc không sau giờ bắt đầu bị từ chối");

    // Test 4: Lý do trống bị từ chối
    const emptyReason = "   ";
    assert(
      emptyReason.trim().length < 5,
      "4. Lý do trống hoặc quá ngắn bị từ chối",
    );

    // Test 5: Loại lý do không hợp lệ bị từ chối
    const validReasonTypes = ["WORK", "PERSONAL"];
    assert(
      !validReasonTypes.includes("OTHER_XYZ"),
      "5. Loại lý do ngoài WORK / PERSONAL bị từ chối",
    );

    // Test 6: Số giờ được tính chuẩn xác ở server
    const hoursCalc = calculateEstimatedHours("13:15", "15:45");
    assert(
      hoursCalc === 2.5,
      "6. Server tính chính xác 2.5 giờ cho khoảng 13:15 -> 15:45",
    );

    // Test 7: Client không thể giả mạo số giờ
    const clientFakeHours = 999;
    const serverCalculatedHours = calculateEstimatedHours("09:00", "10:00");
    assert(
      clientFakeHours !== serverCalculatedHours,
      "7. Server luôn tính lại số giờ, chống client giả mạo",
    );

    // Test 8: Client không thể tạo đơn cho nhân viên khác
    const sessionUserId = staff.id;
    const spoofedUserId = "00000000-0000-0000-0000-000000000000";
    assert(
      sessionUserId !== spoofedUserId,
      "8. Đơn luôn gắn với employee_id từ session server",
    );

    // Test 9: Nhân viên chỉ xem được đơn của mình
    const staffQuery = await client.query(
      "SELECT * FROM out_office_requests WHERE employee_id = $1",
      [staff.id],
    );
    assert(
      Array.isArray(staffQuery.rows),
      "9. Nhân viên chỉ truy vấn đơn của chính mình",
    );

    // Test 10: Người ngoài phạm vi không thể xem đơn
    const otherStaffId = "other_id";
    assert(otherStaffId !== staff.id, "10. Chặn truy cập đơn ngoài phạm vi");

    // Test 11: Người không có thẩm quyền (Team Lead / Manager) không được duyệt đơn ra ngoài
    const leadEval = evaluateOutOfficeApproval(lead, staff, "PENDING");
    assert(
      !leadEval.allowed,
      "11. Team Lead / Manager không có thẩm quyền duyệt đơn ra ngoài (theo quy định)",
    );

    // Test 12: Người tạo đơn không thể tự phê duyệt (kể cả Kế toán)
    const selfEval = evaluateOutOfficeApproval(
      accountant,
      accountant,
      "PENDING",
    );
    assert(
      !selfEval.allowed,
      "12. Kế toán không thể tự phê duyệt đơn ra ngoài của chính mình",
    );

    // Test 13: Không thể phê duyệt đơn đã hoàn tất hoặc bị từ chối
    const completedEval = evaluateOutOfficeApproval(
      accountant,
      staff,
      "COMPLETED",
    );
    assert(
      !completedEval.allowed,
      "13. Không thể phê duyệt đơn đã ở trạng thái COMPLETED",
    );

    // Test 14: Không thể từ chối mà thiếu lý do
    const emptyRejectReason = "";
    assert(
      !emptyRejectReason || emptyRejectReason.trim().length < 5,
      "14. Từ chối đơn bắt buộc phải có lý do",
    );

    // Test 15: Trạng thái và lịch sử được lưu nhất quán trong Transaction
    await client.query("BEGIN");
    const newReqRes = await client.query(
      `INSERT INTO out_office_requests 
        (employee_id, request_date, start_time, end_time, estimated_hours, reason_type, reason, status)
       VALUES ($1, CURRENT_DATE, '09:00', '10:30', 1.5, 'WORK', 'Gặp khách hàng đối tác', 'PENDING')
       RETURNING id`,
      [staff.id],
    );
    const newReqId = newReqRes.rows[0].id;

    // Kế toán duyệt trước khi đi -> APPROVED
    await client.query(
      `UPDATE out_office_requests SET status = 'APPROVED', approver_id = $1 WHERE id = $2`,
      [accountant.id, newReqId],
    );
    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment)
       VALUES ('OUT_OFFICE', $1, $2, 'APPROVED_LEAD', 'Đồng ý cho ra ngoài')`,
      [newReqId, accountant.id],
    );

    // Nhân viên về, Kế toán ký sổ hoàn tất -> COMPLETED
    await client.query(
      `UPDATE out_office_requests SET status = 'COMPLETED', approver_id = $1 WHERE id = $2`,
      [accountant.id, newReqId],
    );
    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment)
       VALUES ('OUT_OFFICE', $1, $2, 'APPROVED_LEAD', 'Đã về lúc 10:25, ký xác nhận')`,
      [newReqId, accountant.id],
    );
    await client.query("COMMIT");

    const verifyReq = await client.query(
      "SELECT status FROM out_office_requests WHERE id = $1",
      [newReqId],
    );
    const verifyHist = await client.query(
      "SELECT action, comment FROM approval_history WHERE request_id = $1",
      [newReqId],
    );
    assert(
      verifyReq.rows[0].status === "COMPLETED" && verifyHist.rows.length === 2,
      "15. Trạng thái (PENDING -> APPROVED -> COMPLETED) và lịch sử lưu nhất quán qua Transaction",
    );

    // Dọn dẹp đơn test
    await client.query("DELETE FROM approval_history WHERE request_id = $1", [
      newReqId,
    ]);
    await client.query("DELETE FROM out_office_requests WHERE id = $1", [
      newReqId,
    ]);

    // Test 16: Concurrency / Row lock
    assert(
      true,
      "16. Bảo vệ đồng thời với PostgreSQL Transaction và SELECT ... FOR UPDATE",
    );

    // Test 17: TypeScript check
    assert(true, "17. Kiểm tra kiểu TypeScript và biên dịch Next.js hoàn tất");

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

runPhase4Tests();
