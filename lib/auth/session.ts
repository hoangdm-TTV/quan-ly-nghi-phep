import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from '@/lib/db/pool';
import { SessionData } from '@/lib/types/user';

const COOKIE_NAME = 'app_session_id';
const SESSION_DURATION_DAYS = 7;

/**
 * Sinh chuỗi định danh session ngẫu nhiên bảo mật 256-bit
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Tạo session mới phía server và lưu vào bảng sessions
 */
export async function createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const sql = `
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, expires_at, created_at
  `;
  await query(sql, [sessionId, userId, expiresAt]);

  return { sessionId, expiresAt };
}

/**
 * Lấy và kiểm tra tính hợp lệ của session từ database
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  if (!sessionId) return null;

  const sql = `
    SELECT id, user_id, expires_at, created_at
    FROM sessions
    WHERE id = $1 AND expires_at > NOW()
    LIMIT 1
  `;
  const res = await query<SessionData>(sql, [sessionId]);
  return res.rows[0] || null;
}

/**
 * Xóa session trong database khi đăng xuất
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

/**
 * Xóa các session đã hết hạn để giải phóng bộ nhớ (dọn dẹp định kỳ)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at <= NOW()');
}

/**
 * Thiết lập Cookie session an toàn trên Header response
 */
export function setSessionCookie(sessionId: string, expiresAt: Date) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Lấy Session ID từ Cookie request
 */
export function getSessionIdFromCookie(): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/**
 * Xóa Cookie session khỏi trình duyệt
 */
export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
