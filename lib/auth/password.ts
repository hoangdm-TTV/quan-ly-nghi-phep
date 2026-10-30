import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Băm mật khẩu bằng bcrypt (an toàn một chiều)
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || plainPassword.length < 6 || Buffer.byteLength(plainPassword, 'utf8') > 72) {
    throw new Error('Password must be at least 6 characters and no more than 72 UTF-8 bytes.');
  }
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Xác minh mật khẩu người dùng nhập với hash trong database
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!plainPassword || !hash) return false;
  try {
    return await bcrypt.compare(plainPassword, hash);
  } catch (err) {
    console.error('[Auth] Error comparing passwords:', err);
    return false;
  }
}
