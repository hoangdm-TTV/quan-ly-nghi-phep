'use client';

import { useState } from 'react';
import HolidayForm from './holiday-form';
import DeleteHolidayButton from './delete-holiday-button';
import { Plus, Calendar, Pencil, FileText } from 'lucide-react';

interface HolidayItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export default function HolidayListClient({
  holidays,
  canManage,
}: {
  holidays: HolidayItem[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<HolidayItem | null>(null);

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const dayCount = (start: string, end: string) => {
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return diff;
  };

  return (
    <div className="space-y-4">
      {canManage && !showForm && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Thêm ngày lễ
          </button>
        </div>
      )}

      {showForm && (
        <HolidayForm
          mode={editTarget ? 'edit' : 'create'}
          holiday={editTarget || undefined}
          onCancel={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
        />
      )}

      {holidays.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Chưa có ngày lễ nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Thêm ngày lễ để hệ thống tự động trừ khi tính số ngày nghỉ phép.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Tên ngày lễ</th>
                  <th className="px-6 py-3.5">Từ ngày</th>
                  <th className="px-6 py-3.5">Đến ngày</th>
                  <th className="px-6 py-3.5">Số ngày</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  {canManage && <th className="px-6 py-3.5 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {h.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{formatDate(h.start_date)}</td>
                    <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{formatDate(h.end_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{dayCount(h.start_date, h.end_date)}</span> ngày
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {h.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Đang áp dụng
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Tạm tắt
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditTarget(h);
                            setShowForm(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors mr-1"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteHolidayButton holidayId={h.id} holidayName={h.name} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
