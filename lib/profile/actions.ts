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

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export async function updateProfileAvatarAction(
  _prevState: ProfileActionState | null,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireAuth();
  const fileValue = formData.get('avatarFile');
  if (!fileValue || typeof fileValue === 'string') {
    return { error: 'Vui lòng chọn ảnh đại diện.' };
  }

  const file = fileValue as File;
  if (file.size <= 0 || file.size > MAX_AVATAR_SIZE) {
    return { error: 'Ảnh phải có dung lượng lớn hơn 0 và không vượt quá 5 MB.' };
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { error: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP.' };
  }

  let imageData: Buffer;
  try {
    imageData = Buffer.from(await file.arrayBuffer());
  } catch {
    return { error: 'Không thể đọc ảnh đã chọn. Vui lòng thử lại.' };
  }

  const isJpeg = file.type === 'image/jpeg' && imageData.length >= 3
    && imageData[0] === 0xff && imageData[1] === 0xd8 && imageData[2] === 0xff;
  const isPng = file.type === 'image/png'
    && imageData.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = file.type === 'image/webp' && imageData.length >= 12
    && imageData.subarray(0, 4).toString('ascii') === 'RIFF'
    && imageData.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) {
    return { error: 'Nội dung ảnh không khớp với định dạng JPEG, PNG hoặc WEBP.' };
  }

  await query(
    `UPDATE users
        SET avatar_data = $1,
            avatar_mime_type = $2,
            avatar_updated_at = NOW(),
            updated_at = NOW()
      WHERE id = $3 AND is_active = TRUE`,
    [imageData, file.type, user.id],
  );

  revalidatePath('/profile');
  revalidatePath('/');
  return { success: true };
}

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
