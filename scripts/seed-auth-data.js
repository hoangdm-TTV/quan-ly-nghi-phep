const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Tự động đọc biến môi trường từ .env.local hoặc .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const fallbackPath = path.resolve(process.cwd(), '.env');
  const target = fs.existsSync(envPath) ? envPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);

  if (target) {
    const content = fs.readFileSync(target, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnv();

if (process.env.NODE_ENV === 'production') {
  console.error('Từ chối chạy seed dữ liệu demo trong môi trường production.');
  process.exit(1);
}
if (process.env.ALLOW_DEMO_SEED !== '1') {
  console.error('Seed này tạo tài khoản demo với mật khẩu dùng chung. Chỉ chạy thử nghiệm cô lập bằng ALLOW_DEMO_SEED=1.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  database: process.env.PGDATABASE || 'quan_ly_nghi_phep',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
});

async function main() {
  console.log('--- BẮT ĐẦU SEED DỮ LIỆU KIỂM THỬ GIAI ĐOẠN 2 ---');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Chạy migration 02 nếu chưa chạy
    const migrationFile = path.resolve(process.cwd(), 'migrations/02_auth_and_extensions.sql');
    if (fs.existsSync(migrationFile)) {
      const migrationSql = fs.readFileSync(migrationFile, 'utf-8');
      await client.query(migrationSql);
      console.log('✓ Đã áp dụng migration 02_auth_and_extensions.sql');
    }

    // 2. Tạo phòng ban mẫu
    const deptRes = await client.query(`
      INSERT INTO departments (name)
      VALUES ('Phòng Công Nghệ'), ('Phòng Kế Toán'), ('Ban Giám Đốc')
      ON CONFLICT DO NOTHING
      RETURNING id, name;
    `);

    // Lấy lại danh sách phòng ban
    const allDepts = await client.query('SELECT id, name FROM departments');
    const itDept = allDepts.rows.find(d => d.name === 'Phòng Công Nghệ')?.id;
    const accDept = allDepts.rows.find(d => d.name === 'Phòng Kế Toán')?.id;
    const dirDept = allDepts.rows.find(d => d.name === 'Ban Giám Đốc')?.id;

    // 3. Tạo team mẫu
    await client.query(`
      INSERT INTO teams (department_id, name)
      VALUES ($1, 'Team Frontend'), ($1, 'Team Backend')
      ON CONFLICT DO NOTHING;
    `, [itDept]);

    const allTeams = await client.query('SELECT id, name FROM teams');
    const feTeam = allTeams.rows.find(t => t.name === 'Team Frontend')?.id;

    // 4. Mật khẩu mẫu chung cho tài khoản test nội bộ (123456)
    const defaultPasswordHash = await bcrypt.hash('123456', 10);

    // 5. Tạo 5 tài khoản mẫu đại diện cho 5 vai trò
    // 5.1 Giám đốc (DIRECTOR)
    const directorRes = await client.query(`
      INSERT INTO users (email, full_name, role, department_id, password_hash, is_active)
      VALUES ('director@company.com', 'Nguyễn Văn Giám Đốc', 'DIRECTOR', $1, $2, TRUE)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id;
    `, [dirDept, defaultPasswordHash]);
    const directorId = directorRes.rows[0].id;

    // 5.2 Kế toán (ACCOUNTANT)
    await client.query(`
      INSERT INTO users (email, full_name, role, department_id, manager_id, password_hash, is_active)
      VALUES ('accountant@company.com', 'Trần Thị Kế Toán', 'ACCOUNTANT', $1, $2, $3, TRUE)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [accDept, directorId, defaultPasswordHash]);

    // 5.3 Trưởng phòng IT (MANAGER)
    const managerRes = await client.query(`
      INSERT INTO users (email, full_name, role, department_id, manager_id, password_hash, is_active)
      VALUES ('manager.it@company.com', 'Lê Văn Trưởng Phòng', 'MANAGER', $1, $2, $3, TRUE)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id;
    `, [itDept, directorId, defaultPasswordHash]);
    const managerId = managerRes.rows[0].id;

    // 5.4 Trưởng nhóm Frontend (TEAM_LEAD)
    const leadRes = await client.query(`
      INSERT INTO users (email, full_name, role, department_id, team_id, manager_id, password_hash, is_active)
      VALUES ('lead.fe@company.com', 'Phạm Văn Trưởng Nhóm', 'TEAM_LEAD', $1, $2, $3, $4, TRUE)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id;
    `, [itDept, feTeam, managerId, defaultPasswordHash]);
    const leadId = leadRes.rows[0].id;

    // 5.5 Nhân viên Frontend (STAFF)
    await client.query(`
      INSERT INTO users (email, full_name, role, department_id, team_id, manager_id, password_hash, is_active)
      VALUES ('staff.fe@company.com', 'Hoàng Văn Nhân Viên', 'STAFF', $1, $2, $3, $4, TRUE)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [itDept, feTeam, leadId, defaultPasswordHash]);

    // 5.6 Tài khoản bị khóa (để test tài khoản vô hiệu hóa)
    await client.query(`
      INSERT INTO users (email, full_name, role, department_id, password_hash, is_active)
      VALUES ('locked.user@company.com', 'Tài Khoản Bị Khóa', 'STAFF', $1, $2, FALSE)
      ON CONFLICT (email) DO UPDATE SET is_active = FALSE, password_hash = EXCLUDED.password_hash;
    `, [itDept, defaultPasswordHash]);

    await client.query('COMMIT');
    console.log('✓ Đã tạo thành công dữ liệu mẫu cho 5 vai trò (mật khẩu test: 123456):');
    console.log('  1. director@company.com   -> DIRECTOR');
    console.log('  2. accountant@company.com -> ACCOUNTANT');
    console.log('  3. manager.it@company.com -> MANAGER');
    console.log('  4. lead.fe@company.com    -> TEAM_LEAD');
    console.log('  5. staff.fe@company.com   -> STAFF');
    console.log('  6. locked.user@company.com -> STAFF (is_active = FALSE)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi seed dữ liệu:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
