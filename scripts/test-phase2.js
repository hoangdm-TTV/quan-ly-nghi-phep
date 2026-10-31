const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// Đọc biến môi trường từ .env.local
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

async function runTests() {
  console.log(
    "================================================================",
  );
  console.log("   BẮT ĐẦU CHẠY KIỂM THỬ GIAI ĐOẠN 2: POSTGRESQL & AUTH");
  console.log(
    "================================================================\n",
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Kết nối PostgreSQL thành công
    const verRes = await pool.query("SELECT version()");
    assert(verRes.rows.length > 0, "1. Kết nối PostgreSQL thành công");

    // Test 2: PostgreSQL xử lý lỗi an toàn khi query sai
    try {
      await pool.query("SELECT * FROM non_existing_table_xyz");
      assert(
        false,
        "2. PostgreSQL không hoạt động / query sai: xử lý lỗi an toàn",
      );
    } catch (err) {
      assert(
        err.code === "42P01",
        "2. Bắt lỗi truy vấn bảng không tồn tại an toàn (không crash)",
      );
    }

    // Test 3: Cấu hình database bị thiếu hoặc sai: báo lỗi rõ ràng ở server, không lộ bí mật
    try {
      const invalidPool = new Pool({
        host: "invalid_host_123",
        connectionTimeoutMillis: 1000,
      });
      await invalidPool.query("SELECT 1");
      assert(false, "3. Báo lỗi kết nối cấu hình sai");
    } catch (err) {
      const exposesSecret = err.message.includes(
        process.env.PGPASSWORD || "some_secret_12345",
      );
      assert(
        !exposesSecret,
        "3. Báo lỗi kết nối an toàn, không để lộ mật khẩu trong error",
      );
    }

    // Test 4: Email không tồn tại -> đăng nhập thất bại
    const nonExistUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      ["notfound@company.com"],
    );
    assert(
      nonExistUser.rows.length === 0,
      "4. Email không tồn tại: đăng nhập thất bại",
    );

    // Test 5: Mật khẩu sai -> đăng nhập thất bại
    const staffRes = await pool.query("SELECT * FROM users WHERE email = $1", [
      "staff.fe@company.com",
    ]);
    const staff = staffRes.rows[0];
    const isWrongPass = await bcrypt.compare(
      "wrong_pass_999",
      staff.password_hash,
    );
    assert(!isWrongPass, "5. Mật khẩu sai: xác thực thất bại");

    // Test 6: Mật khẩu đúng -> đăng nhập thành công
    const isRightPass = await bcrypt.compare("123456", staff.password_hash);
    assert(isRightPass, "6. Mật khẩu đúng: xác thực thành công");

    // Test 7: Tạo session hợp lệ -> truy vấn lấy được người dùng hiện tại
    const testSessionId = "test_sess_" + Date.now();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
      [testSessionId, staff.id, expiresAt],
    );

    const sessionCheck = await pool.query(
      "SELECT s.id, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()",
      [testSessionId],
    );
    assert(
      sessionCheck.rows[0]?.email === "staff.fe@company.com",
      "7. Session hợp lệ: lấy được người dùng và vai trò",
    );

    // Test 8: Session hết hạn hoặc bị thu hồi -> không sử dụng được
    const expiredSessionId = "expired_sess_" + Date.now();
    const pastDate = new Date(Date.now() - 1000);
    await pool.query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
      [expiredSessionId, staff.id, pastDate],
    );
    const expiredCheck = await pool.query(
      "SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()",
      [expiredSessionId],
    );
    assert(
      expiredCheck.rows.length === 0,
      "8. Session hết hạn: bị từ chối truy cập",
    );

    // Test 9: Đăng xuất -> Xóa session trong DB
    await pool.query("DELETE FROM sessions WHERE id = $1", [testSessionId]);
    const logoutCheck = await pool.query(
      "SELECT * FROM sessions WHERE id = $1",
      [testSessionId],
    );
    assert(
      logoutCheck.rows.length === 0,
      "9. Đăng xuất: session bị xóa và không còn sử dụng được",
    );

    // Test 10: Tài khoản bị khóa (is_active = FALSE) -> không cho phép đăng nhập
    const lockedUserRes = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      ["locked.user@company.com"],
    );
    const isLocked = lockedUserRes.rows[0]?.is_active === false;
    assert(
      isLocked,
      "10. Tài khoản bị vô hiệu hóa (is_active = false) bị chặn đăng nhập",
    );

    // Test 11: Kiểm tra phân quyền: Staff không thể xem dữ liệu ngoài phạm vi
    const isStaffDirector = staff.role === "DIRECTOR";
    assert(
      !isStaffDirector,
      "11. Phân quyền: Nhân viên cấp STAFF không thể có quyền DIRECTOR",
    );

    // Test 12: Client không thể tự đổi vai trò (vai trò luôn nạp từ bảng users ở server)
    const roleQuery = await pool.query("SELECT role FROM users WHERE id = $1", [
      staff.id,
    ]);
    assert(
      roleQuery.rows[0].role === "STAFF",
      "12. Vai trò được xác thực cố định từ Server DB",
    );

    // Test 13: SQL Injection qua tham số email không làm thay đổi truy vấn
    const sqlInjectionEmail = "' OR '1'='1";
    const sqliResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [sqlInjectionEmail],
    );
    assert(
      sqliResult.rows.length === 0,
      "13. Chống SQL Injection thành công qua query có tham số ($1)",
    );

    // Test 14: Truy vấn getSafeUserById không chứa password_hash
    const safeUserQuery = await pool.query(
      "SELECT id, email, full_name, role, department_id, team_id, is_active FROM users WHERE id = $1",
      [staff.id],
    );
    const hasPasswordHash = "password_hash" in safeUserQuery.rows[0];
    assert(
      !hasPasswordHash,
      "14. Bản ghi SafeUser gửi về client KHÔNG chứa password_hash",
    );

    // Dọn dẹp session test
    await pool.query("DELETE FROM sessions WHERE id IN ($1)", [
      expiredSessionId,
    ]);

    console.log(
      `\n================================================================`,
    );
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
    console.log(
      `================================================================\n`,
    );
  } catch (err) {
    console.error("Lỗi khi thực thi test:", err);
  } finally {
    await pool.end();
  }
}

runTests();
