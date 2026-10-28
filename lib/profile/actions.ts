'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/permissions';
import { query } from '@/lib/db/pool';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export type ProfileActionState = {
  success?: boolean;
  error?: string;
};

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự.'),
  confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới.'),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp.',
  path: ['confirmPassword'],
});

export async function changePasswordAction(
  _prevState: ProfileActionState | null,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireAuth();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Thông tin mật khẩu không hợp lệ.' };
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' };
  }

  const result = await query<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
    [user.id]
  );
  const passwordHash = result.rows[0]?.password_hash;
  if (!passwordHash || !(await verifyPassword(parsed.data.currentPassword, passwordHash))) {
    return { error: 'Mật khẩu hiện tại không chính xác.' };
  }

  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [await hashPassword(parsed.data.newPassword), user.id]);
  revalidatePath('/profile');
  return { success: true };
}
