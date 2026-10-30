'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Search, Users } from 'lucide-react';
import type { AbsenceCalendarItem } from '@/lib/dashboard/calendar';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

export default function AbsenceCalendar({ items }: { items: AbsenceCalendarItem[] }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | 'LEAVE' | 'OUT_OFFICE'>('ALL');
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.employeeName} ${item.departmentName || ''} ${item.teamName || ''}`.toLocaleLowerCase();
    return (type === 'ALL' || item.type === type) && haystack.includes(search.toLocaleLowerCase().trim());
  }), [items, search, type]);

  return (
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#005a3c]" /> Lịch vắng mặt</h2>
          <p className="text-xs sm:text-sm text-slate-500">Các đơn đã duyệt trong phạm vi quyền của bạn; có thể lọc thêm theo ngày ở phần báo cáo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm người, phòng, team" className="pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 w-56" /></label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="px-3 py-2 text-xs rounded-lg border border-slate-300"><option value="ALL">Tất cả</option><option value="LEAVE">Nghỉ phép</option><option value="OUT_OFFICE">Ra ngoài</option></select>
        </div>
      </div>
      {filtered.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Không có lịch vắng mặt phù hợp.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article key={`${item.type}-${item.id}`} className={`rounded-xl border p-4 ${item.type === 'LEAVE' ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/50'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{item.employeeName}</p><p className="text-xs text-slate-500">{item.departmentName || 'Chưa phân bổ'}{item.teamName ? ` · ${item.teamName}` : ''}</p></div><span className="text-[11px] font-bold uppercase tracking-wide">{item.type === 'LEAVE' ? 'Nghỉ phép' : 'Ra ngoài'}</span></div><div className="mt-3 flex items-center gap-2 text-sm text-slate-700"><CalendarDays className="w-4 h-4" />{item.startDate === item.endDate ? formatDate(item.startDate) : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`}</div>{item.type === 'LEAVE' ? <p className="mt-1 text-xs font-semibold text-emerald-800">{item.dayPart === 'MORNING' ? 'Buổi sáng' : item.dayPart === 'AFTERNOON' ? 'Buổi chiều' : `${item.duration} ngày`}</p> : <p className="mt-1 text-xs font-semibold text-blue-800 flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{item.startTime?.slice(0, 5)} – {item.endTime?.slice(0, 5)} ({item.duration} giờ)</p>}{item.reason && <p className="mt-3 text-xs text-slate-600 line-clamp-2">{item.reason}</p>}</article>)}</div>}
      <p className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Hiển thị {filtered.length} mục trong phạm vi quyền của bạn.</p>
    </section>
  );
}
