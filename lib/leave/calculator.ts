/**
 * Tiện ích tính toán số ngày nghỉ phép phía Server
 * Quy tắc: Công ty làm việc từ Thứ 2 đến Thứ 7, nghỉ ngày Chủ Nhật (Sunday).
 * Số ngày làm việc = tổng số ngày trong khoảng [start, end] loại trừ Chủ Nhật và ngày lễ.
 */

import { getActiveHolidaysInRange } from "@/lib/holidays/queries";

export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Định dạng ngày không hợp lệ. Yêu cầu YYYY-MM-DD.");
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface HolidayRange {
  start_date: string;
  end_date: string;
}

function isDateInHolidays(dateStr: string, holidays: HolidayRange[]): boolean {
  return holidays.some((h) => dateStr >= h.start_date && dateStr <= h.end_date);
}

/**
 * Tính số ngày làm việc thực tế (bỏ qua Chủ Nhật và ngày lễ)
 */
export function calculateWorkingDays(
  startDateStr: string,
  endDateStr: string,
  holidays: HolidayRange[] = [],
): number {
  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);

  if (end < start) {
    throw new Error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
  }

  let workingDays = 0;
  const current = new Date(start.getTime());

  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0 là Chủ Nhật, 1: T2, ..., 6: T7
    const currentDateStr = formatDateOnly(current);
    if (dayOfWeek !== 0 && !isDateInHolidays(currentDateStr, holidays)) {
      workingDays += 1;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workingDays;
}

/**
 * Tính số ngày làm việc thực tế, tự động lấy ngày lễ từ database
 */
export async function calculateWorkingDaysWithHolidays(
  startDateStr: string,
  endDateStr: string,
): Promise<number> {
  const holidays = await getActiveHolidaysInRange(startDateStr, endDateStr);
  return calculateWorkingDays(startDateStr, endDateStr, holidays);
}
