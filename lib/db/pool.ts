import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

// Đảm bảo module database chỉ được chạy ở server
if (typeof window !== "undefined") {
  throw new Error("Database module can only be executed on the server.");
}

const connectionString = process.env.DATABASE_URL;

const poolConfig: PoolConfig = connectionString
  ? { connectionString }
  : {
      host: process.env.PGHOST || "localhost",
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      database: process.env.PGDATABASE || "quan_ly_nghi_phep",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD,
    };

// Sử dụng globalThis để giữ singleton connection pool trong môi trường Next.js development (hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  globalThis.__pgPool ??
  new Pool({
    ...poolConfig,
    max: 10, // Giới hạn số connection trong pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}

/**
 * Hàm truy vấn database có tham số ($1, $2...) chống SQL Injection
 * Xử lý lỗi an toàn không để lộ connection string hay thông tin nhạy cảm
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    return res;
  } catch (error: any) {
    // Không log connection string, chỉ log thông điệp lỗi kỹ thuật nội bộ phía server
    console.error("[DB Error]", {
      code: error.code,
      duration: `${Date.now() - start}ms`,
    });
    throw new Error("Database query failed.");
  }
}

/**
 * Kiểm tra kết nối tới PostgreSQL thực tế
 */
export async function testConnection(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const res = await query("SELECT version() AS ver");
    return { ok: true, version: res.rows[0]?.ver };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
