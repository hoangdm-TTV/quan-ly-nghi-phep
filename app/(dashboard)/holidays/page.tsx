import { requireAuth } from '@/lib/auth/permissions';
import { getAllHolidays } from '@/lib/holidays/queries';
import { redirect } from 'next/navigation';
import HolidayForm from '@/components/holidays/holiday-form';
import DeleteHolidayButton from '@/components/holidays/delete-holiday-button';
import HolidayListClient from '@/components/holidays/holiday-list-client';
import { Calendar, Plus, CalendarDays } from 'lucide-react';
import { canManageHolidays } from '@/lib/auth/roles';

export const metadata = {
  title: 'Quản lý ngày lễ | Tri Thức Việt',
};

export default async function HolidaysPage() {
  const user = await requireAuth();
  if (!canManageHolidays(user.role)) {
    redirect('/');
  }

  const holidays = await getAllHolidays();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Quản lý ngày lễ công ty
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Quản lý danh sách ngày nghỉ lễ công ty Tri Thức Việt. Hệ thống sẽ tự động trừ các ngày này khi tính số ngày nghỉ phép.
        </p>
      </div>

      <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-5 flex items-start gap-3 shadow-xs">
        <CalendarDays className="w-5 h-5 text-[#005a3c] shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-emerald-950 space-y-1.5 font-medium">
          <p className="font-bold text-[#005a3c] text-sm">Quy định lịch làm việc công ty: Thứ 2 – Thứ 7</p>
          <p>• Hệ thống tự động trừ ngày Chủ Nhật khi tính số ngày nghỉ phép thực tế.</p>
          <p>• Các ngày lễ trong danh sách dưới đây cũng được tự động trừ khi tính thời lượng nghỉ.</p>
          <p>• Ngày lễ có thể là 1 ngày hoặc một khoảng ngày (ví dụ: nghỉ Tết Âm lịch từ 25/01 đến 01/02).</p>
          <p>• Bạn có thể bật/tắt trạng thái áp dụng của từng ngày lễ mà không cần xóa dữ liệu.</p>
        </div>
      </div>

      <HolidayListClient holidays={holidays} canManage={true} />
    </div>
  );
}
