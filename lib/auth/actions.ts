'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getUserByEmail } from '@/lib/db/queries/users';
import { verifyPassword } from './password';
import { createSession, setSessionCookie, deleteSession, clearSessionCookie, getSessionIdFromCookie } from './session';

const loginSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ').min(1, 'Vui lòng nhập email'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
});

export type ActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Server Action xử lý đăng nhập an toàn
 */
export async function loginAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  const validated = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!validated.success) {
    return {
      error: validated.error.errors[0]?.message || 'Dữ liệu nhập vào không hợp lệ',
    };
  }

  const { email, password } = validated.data;

  try {
    // 1. Tìm người dùng theo email
    const user = await getUserByEmail(email);

    // Không tìm thấy user hoặc chưa được thiết lập mật khẩu
    if (!user || !user.password_hash) {
      return { error: 'Email hoặc mật khẩu không chính xác' };
    }

    // 2. Kiểm tra tài khoản có bị vô hiệu hóa không
    if (!user.is_active) {
      return { error: 'Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên.' };
    }

    // 3. Xác minh mật khẩu băm
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return { error: 'Email hoặc mật khẩu không chính xác' };
    }

    // 4. Tạo session an toàn phía server
    const { sessionId, expiresAt } = await createSession(user.id);

    // 5. Thiết lập Cookie HttpOnly an toàn
    setSessionCookie(sessionId, expiresAt);
  } catch (err: any) {
    console.error('[Login Action Error]', err.message);
    return { error: 'Hệ thống đang bận hoặc có lỗi kết nối database. Vui lòng thử lại sau.' };
  }

  // 6. Chuyển hướng tới trang nội bộ sau khi đăng nhập thành công
  redirect('/');
}

/**
 * Server Action xử lý đăng xuất an toàn
 */
export async function logoutAction(): Promise<void> {
  const sessionId = getSessionIdFromCookie();
  if (sessionId) {
    try {
      await deleteSession(sessionId);
    } catch (err) {
      console.error('[Logout Action Error]', err);
    }
  }

  clearSessionCookie();
  redirect('/login');
}
