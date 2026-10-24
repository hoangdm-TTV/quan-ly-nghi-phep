'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createLeaveRequestAction, LeaveActionState } from '@/lib/leave/actions';
import { Calendar, FileText, AlertCircle, Loader2, ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

function calculateDaysClient(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (end < start) return 0;

  let count = 0;
  const cur = new Date(start.getTime());
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      // Bỏ qua Chủ Nhật (0)
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Đang gửi đơn...
        </>
      ) : (
        <>
          <Send className="w-4 h-4 mr-2" />
          Gửi đơn nghỉ phép
        </>
      )}
    </button>
  );
}

export default function LeaveForm() {
  const initialState: LeaveActionState = {};
  const [state, formAction] = useFormState(createLeaveRequestAction, initialState);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const calculatedDays = calculateDaysClient(startDate, endDate);

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
      {state.error && (
        <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1">
            Từ ngày
          </label>
          <div className="relative">
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1">
            Đến ngày
          </label>
          <div className="relative">
            <input
              id="endDate"
              name="endDate"
              type="date"
              required
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {startDate && endDate && (
        <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 space-y-1">
          <p className="font-semibold text-sm text-blue-900">
            Số ngày làm việc dự kiến: <span className="text-base text-blue-700 font-bold">{calculatedDays}</span> ngày
          </p>
          <p className="text-blue-600">
            • Lịch làm việc công ty: Thứ 2 – Thứ 7 (Hệ thống đã tự động trừ ngày Chủ Nhật).
          </p>
          <p className="text-blue-600">
            {calculatedDays <= 1
              ? '• Đơn tối đa 1 ngày: Trưởng phòng cùng phòng ban duyệt.'
              : '• Đơn từ 2 ngày trở lên: Cần 2 cấp phê duyệt (Cấp 1 duyệt xong sẽ chuyển đến Giám đốc).'}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
          Lý do xin nghỉ phép
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={4}
          required
          placeholder="Mô tả cụ thể lý do xin nghỉ phép (tối thiểu 5 ký tự)..."
          className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        ></textarea>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <Link
          href="/leave"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Quay lại danh sách
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
