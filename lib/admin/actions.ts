'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/permissions';
import { pool } from '@/lib/db/pool';
import { hashPassword } from '@/lib/auth/password';
import { canManageHr, PRIMARY_ADMIN_EMAIL } from '@/lib/auth/admin-account';

export type AdminActionState = { success?: string; error?: string };

function isUuidOrEmpty(value: string) {
  return value === '' || z.string().uuid().safeParse(value).success;
}

const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  employeeCode: z.string().trim().max(50).optional(),
  fullName: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  role: z.enum(['STAFF', 'TEAM_LEAD', 'MANAGER', 'ACCOUNTANT', 'ADMIN', 'DIRECTOR']),
  position: z.string().trim().max(150).optional(),
  departmentId: z.string().refine(isUuidOrEmpty),
  teamId: z.string().refine(isUuidOrEmpty),
  managerId: z.string().refine(isUuidOrEmpty),
  employmentStatus: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED']),
  isActive: z.enum(['true', 'false']),
  password: z.string().optional(),
});

async function requireHrAdmin() {
  const user = await requireAuth();
  if (!canManageHr(user)) throw new Error('Không có quyền quản trị nhân sự.');
  return user;
}

export async function saveEmployeeAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireHrAdmin();
  const parsed = employeeSchema.safeParse({
    id: formData.get('id') || undefined,
    employeeCode: formData.get('employeeCode') || undefined,
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    role: formData.get('role'),
    position: formData.get('position') || undefined,
    departmentId: formData.get('departmentId') || '',
    teamId: formData.get('teamId') || '',
    managerId: formData.get('managerId') || '',
    employmentStatus: formData.get('employmentStatus') || 'ACTIVE',
    isActive: formData.get('isActive'),
    password: formData.get('password') || '',
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Thông tin nhân sự không hợp lệ.' };
  const data = parsed.data;
  const employeeId = data.id || undefined;
  if (data.role === 'ADMIN' && data.email.trim() !== PRIMARY_ADMIN_EMAIL) return { error: 'Chỉ tài khoản quản trị hệ thống được chỉ định mới có vai trò ADMIN.' };
  if (!employeeId && (!data.password || data.password.length < 6 || Buffer.byteLength(data.password, 'utf8') > 72)) {
    return { error: 'Tài khoản mới cần mật khẩu từ 6 ký tự, tối đa 72 byte.' };
  }
  if (employeeId && data.password && (data.password.length < 6 || Buffer.byteLength(data.password, 'utf8') > 72)) {
    return { error: 'Mật khẩu mới cần từ 6 ký tự và tối đa 72 byte.' };
  }
  if (employeeId && employeeId === actor.id && (data.isActive !== 'true' || data.employmentStatus !== 'ACTIVE')) {
    return { error: 'Không thể tự khóa tài khoản đang đăng nhập.' };
  }
  if (employeeId && employeeId === actor.id && data.role !== actor.role) {
    return { error: 'Không thể tự thay đổi vai trò tài khoản đang đăng nhập.' };
  }
  if (employeeId === actor.id && data.email.trim() !== PRIMARY_ADMIN_EMAIL) return { error: 'Không thể đổi email tài khoản quản trị hệ thống.' };
  if (employeeId && employeeId === actor.id && data.password) {
    return { error: 'Hãy đổi mật khẩu của chính bạn trong trang Hồ sơ tài khoản.' };
  }
  if (employeeId) {
      const current = await pool.query<{ role: string; employment_status: string }>('SELECT role, employment_status FROM users WHERE id = $1', [employeeId]);
    if (current.rows[0]?.role === 'DIRECTOR' && data.role !== 'DIRECTOR') return { error: 'Không thể đổi vai trò Giám đốc từ trang quản trị nhân sự.' };
    if (data.role === 'DIRECTOR' && current.rows[0]?.role !== 'DIRECTOR') return { error: 'Không thể cấp vai trò Giám đốc từ trang quản trị nhân sự.' };
  } else if (data.role === 'DIRECTOR') {
    return { error: 'Không thể cấp vai trò Giám đốc từ trang quản trị nhân sự.' };
  }
  if (employeeId && data.managerId === employeeId) return { error: 'Nhân viên không thể là quản lý trực tiếp của chính mình.' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (data.teamId) {
      const team = await client.query<{ department_id: string | null }>('SELECT department_id FROM teams WHERE id = $1', [data.teamId]);
      if (!team.rows[0] || (team.rows[0].department_id && team.rows[0].department_id !== (data.departmentId || null))) {
        await client.query('ROLLBACK');
        return { error: 'Team đã chọn không thuộc phòng ban này.' };
      }
    }
    if (data.managerId) {
      const manager = await client.query<{ is_active: boolean }>('SELECT is_active FROM users WHERE id = $1', [data.managerId]);
      if (!manager.rows[0]?.is_active) {
        await client.query('ROLLBACK');
        return { error: 'Quản lý trực tiếp không tồn tại hoặc đã bị khóa.' };
      }
    }
    const values = [
      data.employeeCode || null, data.fullName, data.email.toLowerCase(), data.role,
      data.position || null, data.departmentId || null, data.teamId || null,
      data.managerId || null, data.employmentStatus === 'ACTIVE',
    ];
    if (employeeId) {
      const passwordHash = data.password ? await hashPassword(data.password) : null;
      const before = await client.query('SELECT employee_code, full_name, email, role, position, department_id, team_id, manager_id, is_active, employment_status FROM users WHERE id = $1 FOR UPDATE', [employeeId]);
      await client.query(
        `UPDATE users SET employee_code = $1, full_name = $2, email = $3, role = $4,
                position = $5, department_id = $6, team_id = $7, manager_id = $8,
                is_active = $9, employment_status = $10, password_hash = COALESCE($11, password_hash), updated_at = NOW()
          WHERE id = $12`,
        [...values, data.employmentStatus, passwordHash, employeeId],
      );
      await client.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)', [actor.id, 'UPDATE_EMPLOYEE', 'USER', employeeId, JSON.stringify(before.rows[0] || null), JSON.stringify({ ...data, password: undefined })]);
      if (data.employmentStatus !== 'ACTIVE' || passwordHash) {
        await client.query('DELETE FROM sessions WHERE user_id = $1', [employeeId]);
      }
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (employee_code, full_name, email, role, position, department_id, team_id, manager_id, is_active, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [...values.slice(0, 8), data.employmentStatus === 'ACTIVE', await hashPassword(data.password!)],
      );
      await client.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, after_data) VALUES ($1, $2, $3, $4, $5::jsonb)', [actor.id, 'CREATE_EMPLOYEE', 'USER', inserted.rows[0]?.id, JSON.stringify({ ...data, password: undefined })]);
    }
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    const code = (error as { code?: string }).code;
    console.error('[HR Save Employee Error]', { code });
    if (code === '23505') return { error: 'Email hoặc mã nhân viên đã được sử dụng.' };
    return { error: 'Không thể lưu thông tin nhân sự lúc này.' };
  } finally {
    client.release();
  }
  revalidatePath('/admin/hr');
  revalidatePath('/');
  return { success: 'Đã lưu hồ sơ nhân sự.' };
}

const nameSchema = z.object({ name: z.string().trim().min(2).max(255) });
export async function deleteEmployeeAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireHrAdmin();
  const parsed = z.string().uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { error: 'Mã nhân viên không hợp lệ.' };
  if (parsed.data === actor.id) return { error: 'Không thể xóa tài khoản đang đăng nhập.' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [parsed.data]);
    if (!target.rowCount) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy nhân viên.' };
    }
    const references = await client.query<{ linked: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM leave_requests WHERE employee_id = $1 OR approver_id = $1)
           OR EXISTS (SELECT 1 FROM out_office_requests WHERE employee_id = $1 OR approver_id = $1)
           OR EXISTS (SELECT 1 FROM approval_history WHERE approver_id = $1)
           OR EXISTS (SELECT 1 FROM request_change_history WHERE actor_id = $1)
           OR EXISTS (SELECT 1 FROM leave_entitlements WHERE user_id = $1 OR updated_by = $1)
           OR EXISTS (SELECT 1 FROM users WHERE manager_id = $1) AS linked`,
      [parsed.data],
    );
    if (references.rows[0]?.linked) {
      await client.query('ROLLBACK');
      return { error: 'Nhân viên đã có đơn, lịch sử hoặc nhân sự trực thuộc. Hãy khóa tài khoản để giữ dữ liệu.' };
    }
    await client.query('DELETE FROM users WHERE id = $1', [parsed.data]);
    await client.query('COMMIT');
    revalidatePath('/admin/hr');
    return { success: 'Đã xóa nhân viên.' };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    if ((error as { code?: string }).code === '23503') return { error: 'Nhân viên đã có đơn hoặc dữ liệu liên quan. Hãy khóa tài khoản để giữ lịch sử thay vì xóa.' };
    return { error: 'Không thể xóa nhân viên lúc này.' };
  } finally { client.release(); }
}

export async function createDepartmentAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireHrAdmin();
  const parsed = nameSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: 'Tên phòng ban cần từ 2 đến 255 ký tự.' };
  try {
    await pool.query('INSERT INTO departments (name) VALUES ($1)', [parsed.data.name]);
    revalidatePath('/admin/hr');
    return { success: 'Đã thêm phòng ban.' };
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return { error: 'Tên phòng ban đã tồn tại.' };
    return { error: 'Không thể thêm phòng ban lúc này.' };
  }
}

const namedIdSchema = nameSchema.extend({ id: z.string().uuid() });
export async function updateDepartmentAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireHrAdmin();
  const parsed = namedIdSchema.safeParse({ id: formData.get('id'), name: formData.get('name') });
  if (!parsed.success) return { error: 'Thông tin phòng ban không hợp lệ.' };
  try {
    const result = await pool.query('UPDATE departments SET name = $1 WHERE id = $2', [parsed.data.name, parsed.data.id]);
    if (!result.rowCount) return { error: 'Không tìm thấy phòng ban.' };
    revalidatePath('/admin/hr');
    return { success: 'Đã cập nhật phòng ban.' };
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return { error: 'Tên phòng ban đã tồn tại.' };
    return { error: 'Không thể cập nhật phòng ban lúc này.' };
  }
}

export async function deleteDepartmentAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireHrAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Mã phòng ban không hợp lệ.' };
  const usage = await pool.query<{ used: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM users WHERE department_id=$1) OR EXISTS(SELECT 1 FROM teams WHERE department_id=$1) AS used`, [id.data]);
  if (usage.rows[0]?.used) return { error: 'Chuyển nhân sự và team ra khỏi phòng ban trước khi xóa.' };
  await pool.query('DELETE FROM departments WHERE id = $1', [id.data]);
  revalidatePath('/admin/hr');
  return { success: 'Đã xóa phòng ban.' };
}

const teamSchema = nameSchema.extend({ departmentId: z.string().uuid() });
export async function createTeamAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireHrAdmin();
  const parsed = teamSchema.safeParse({ name: formData.get('name'), departmentId: formData.get('departmentId') });
  if (!parsed.success) return { error: 'Hãy nhập tên team và chọn phòng ban hợp lệ.' };
  try {
    await pool.query('INSERT INTO teams (name, department_id) VALUES ($1, $2)', [parsed.data.name, parsed.data.departmentId]);
    revalidatePath('/admin/hr');
    return { success: 'Đã thêm team.' };
  } catch {
    return { error: 'Không thể thêm team lúc này.' };
  }
}

const teamUpdateSchema = teamSchema.extend({ id: z.string().uuid() });
export async function updateTeamAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireHrAdmin();
  const parsed = teamUpdateSchema.safeParse({ id: formData.get('id'), name: formData.get('name'), departmentId: formData.get('departmentId') });
  if (!parsed.success) return { error: 'Thông tin team không hợp lệ.' };
  try {
    const result = await pool.query('UPDATE teams SET name=$1, department_id=$2 WHERE id=$3', [parsed.data.name, parsed.data.departmentId, parsed.data.id]);
    if (!result.rowCount) return { error: 'Không tìm thấy team.' };
    revalidatePath('/admin/hr');
    return { success: 'Đã cập nhật team.' };
  } catch { return { error: 'Không thể cập nhật team lúc này.' }; }
}

export async function deleteTeamAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireHrAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Mã team không hợp lệ.' };
  const usage = await pool.query<{ used: boolean }>('SELECT EXISTS(SELECT 1 FROM users WHERE team_id=$1) AS used', [id.data]);
  if (usage.rows[0]?.used) return { error: 'Chuyển nhân sự ra khỏi team trước khi xóa.' };
  await pool.query('DELETE FROM teams WHERE id=$1', [id.data]);
  revalidatePath('/admin/hr');
  return { success: 'Đã xóa team.' };
}

const entitlementSchema = z.object({
  userId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2200),
  days: z.coerce.number().min(0).max(366),
});
export async function setLeaveEntitlementAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireHrAdmin();
  const parsed = entitlementSchema.safeParse({ userId: formData.get('userId'), year: formData.get('year'), days: formData.get('days') });
  if (!parsed.success) return { error: 'Thông tin hạn mức nghỉ phép không hợp lệ.' };
  try {
    await pool.query(
      `INSERT INTO leave_entitlements (user_id, leave_year, entitled_days, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, leave_year) DO UPDATE
         SET entitled_days = EXCLUDED.entitled_days, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [parsed.data.userId, parsed.data.year, parsed.data.days, actor.id],
    );
    revalidatePath('/admin/hr');
    revalidatePath('/profile');
    revalidatePath('/');
    return { success: 'Đã cập nhật hạn mức nghỉ phép.' };
  } catch {
    return { error: 'Không thể cập nhật hạn mức lúc này.' };
  }
}
