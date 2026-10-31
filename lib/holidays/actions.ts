"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db/pool";
import { requireAuth } from "@/lib/auth/permissions";
import { canManageHolidays } from "@/lib/auth/roles";

const holidaySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên ngày lễ phải có ít nhất 2 ký tự")
    .max(255, "Tên quá dài"),
  startDate: z
    .string()
    .refine(isRealDate, "Ngày bắt đầu không hợp lệ (YYYY-MM-DD)"),
  endDate: z
    .string()
    .refine(isRealDate, "Ngày kết thúc không hợp lệ (YYYY-MM-DD)"),
  isActive: z.string().optional(),
});

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export type HolidayActionState = {
  success?: boolean;
  error?: string;
};

export async function createHolidayAction(
  _prevState: HolidayActionState | null,
  formData: FormData,
): Promise<HolidayActionState> {
  const currentUser = await requireAuth();
  if (!canManageHolidays(currentUser.role)) {
    return { error: "Bạn không có quyền quản lý ngày lễ." };
  }

  const validated = holidaySchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isActive: formData.get("isActive"),
  });

  if (!validated.success) {
    return {
      error: validated.error.errors[0]?.message || "Dữ liệu không hợp lệ.",
    };
  }

  const { name, startDate, endDate, isActive } = validated.data;
  if (endDate < startDate) {
    return { error: "Ngày kết thúc không được nhỏ hơn ngày bắt đầu." };
  }

  try {
    await pool.query(
      `INSERT INTO holidays (name, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4)`,
      [name, startDate, endDate, isActive === "true"],
    );
  } catch (err: any) {
    console.error("[Create Holiday Error]", err.message);
    return { error: "Không thể tạo ngày lễ lúc này. Vui lòng thử lại sau." };
  }

  revalidatePath("/holidays");
  redirect("/holidays");
}

export async function updateHolidayAction(
  _prevState: HolidayActionState | null,
  formData: FormData,
): Promise<HolidayActionState> {
  const currentUser = await requireAuth();
  if (!canManageHolidays(currentUser.role)) {
    return { error: "Bạn không có quyền quản lý ngày lễ." };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "Thiếu mã ngày lễ." };

  const validated = holidaySchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isActive: formData.get("isActive"),
  });

  if (!validated.success) {
    return {
      error: validated.error.errors[0]?.message || "Dữ liệu không hợp lệ.",
    };
  }

  const { name, startDate, endDate, isActive } = validated.data;
  if (endDate < startDate) {
    return { error: "Ngày kết thúc không được nhỏ hơn ngày bắt đầu." };
  }

  try {
    const result = await pool.query(
      `UPDATE holidays
       SET name = $1, start_date = $2, end_date = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5`,
      [name, startDate, endDate, isActive === "true", id],
    );
    if (result.rowCount === 0) {
      return { error: "Không tìm thấy ngày lễ cần cập nhật." };
    }
  } catch (err: any) {
    console.error("[Update Holiday Error]", err.message);
    return {
      error: "Không thể cập nhật ngày lễ lúc này. Vui lòng thử lại sau.",
    };
  }

  revalidatePath("/holidays");
  redirect("/holidays");
}

export async function deleteHolidayAction(
  _prevState: HolidayActionState | null,
  formData: FormData,
): Promise<HolidayActionState> {
  const currentUser = await requireAuth();
  if (!canManageHolidays(currentUser.role)) {
    return { error: "Bạn không có quyền quản lý ngày lễ." };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "Thiếu mã ngày lễ." };

  try {
    const result = await pool.query("DELETE FROM holidays WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return { error: "Không tìm thấy ngày lễ cần xóa." };
    }
  } catch (err: any) {
    console.error("[Delete Holiday Error]", err.message);
    return { error: "Không thể xóa ngày lễ lúc này. Vui lòng thử lại sau." };
  }

  revalidatePath("/holidays");
  return { success: true };
}
