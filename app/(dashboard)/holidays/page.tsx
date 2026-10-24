import { requireAuth } from '@/lib/auth/permissions';
import { getAllHolidays } from '@/lib/holidays/queries';
import { redirect } from 'next/navigation';
import HolidayForm from '@/components/holidays/holiday-form';
import DeleteHolidayButton from '@/components/holidays/delete-holiday-button';
import HolidayListClient from '@/components/holidays/holiday-list-client';
import { Calendar, Plus, CalendarDays } from 'lucide-react';

export const metadata = {
  title: 'Quản lý ngày lễ | Leave & Gate Pass',
};

export default async function HolidaysPage() {
  const user = await requireAuth();
  if (user.role !== 'DIRECTOR') {
    redirect('/');
  }

  const holidays = await getAllHolidays();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quản lý ngày lễ</h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý danh sách ngày nghỉ lễ công ty. Hệ thống sẽ tự động trừ các ngày này khi tính số ngày nghỉ phép.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-semibold text-blue-900">Lịch làm việc công ty: Thứ 2 – Thứ 7</p>
          <p>• Hệ thống tự động trừ ngày Chủ Nhật khi tính số ngày nghỉ phép.</p>
          <p>• Các ngày lễ trong danh sách dưới đây cũng được trừ khi tính số ngày nghỉ.</p>
          <p>• Ngày lễ có thể là 1 ngày hoặc một khoảng ngày (ví dụ: nghỉ Tết từ 25/01 đến 01/02).</p>
          <p>• Bật/tắt ngày lễ bằng trường &ldquo;Áp dụng&rdquo; mà không cần xóa.</p>
        </div>
      </div>

      <HolidayListClient holidays={holidays} canManage={true} />
    </div>
  );
}
