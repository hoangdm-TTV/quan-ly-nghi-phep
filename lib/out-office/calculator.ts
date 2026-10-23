/**
 * Tiện ích tính số giờ ra ngoài (estimated_hours) phía Server
 * Quy tắc: Đơn ra ngoài thực hiện trong ngày, giờ kết thúc phải sau giờ bắt đầu.
 */

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    throw new Error('Định dạng giờ không hợp lệ. Yêu cầu HH:MM.');
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Giờ hoặc phút không hợp lệ.');
  }

  return hours * 60 + minutes;
}

/**
 * Tính số giờ ra ngoài dự kiến (làm tròn 2 chữ số thập phân, ví dụ 1.50 giờ)
 */
export function calculateEstimatedHours(startTimeStr: string, endTimeStr: string): number {
  const startMinutes = parseTimeToMinutes(startTimeStr);
  const endMinutes = parseTimeToMinutes(endTimeStr);

  if (endMinutes <= startMinutes) {
    throw new Error('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
  }

  const diffMinutes = endMinutes - startMinutes;
  const hours = diffMinutes / 60;

  // Làm tròn 2 chữ số thập phân
  return Math.round(hours * 100) / 100;
}
