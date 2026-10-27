'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createLeaveRequestAction, LeaveActionState } from '@/lib/leave/actions';
import { Calendar, FileText, AlertCircle, Loader2, ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import RequestReviewModal from '@/components/requests/request-review-modal';

function calculateDaysClient(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (end < start) return 0;

  let count = 0;
  const cur = new Date(start.getTime());
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`)
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl shadow-xs text-sm font-bold text-white bg-[#005a3c] hover:bg-[#044e3f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#005a3c] disabled:opacity-50 transition-all"
    >
      {pending ? (
        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang gửi đơn...</>
      ) : (
        <><Send className="w-4 h-4 mr-2" /> Gửi đơn nghỉ phép</>
      )}
    </button>
  );
}

export default function LeaveForm() {
  const initialState: LeaveActionState = {};
  const [state, formAction] = useFormState(createLeaveRequestAction, initialState);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState({ startDate: '', endDate: '', reason: '' });
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const calculatedDays = calculateDaysClient(startDate, endDate);

  useEffect(() => {
    if (state.error) confirmedRef.current = false;
  }, [state.error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }

    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setReviewData({
      startDate: String(data.get('startDate') || ''),
      endDate: String(data.get('endDate') || ''),
      reason: String(data.get('reason') || '').trim(),
    });
    setReviewOpen(true);
  }

  function confirmSubmit() {
    confirmedRef.current = true;
    setReviewOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-6">
        {state.error && (
          <div className="flex items-center p-3 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> <span>{state.error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Từ ngày</label>
            <div className="relative">
              <input id="startDate" name="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005a3c] focus:border-[#005a3c]" />
            </div>
          </div>
          <div>
            <label htmlFor="endDate" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Đến ngày</label>
            <div className="relative">
              <input id="endDate" name="endDate" type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005a3c] focus:border-[#005a3c]" />
            </div>
          </div>
        </div>

        {startDate && endDate && (
          <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-xl text-xs sm:text-sm text-emerald-950 space-y-1">
            <p className="font-bold text-sm text-[#005a3c]">Số ngày làm việc dự kiến: <span className="text-base font-black">{calculatedDays}</span> ngày</p>
            <p className="text-emerald-800 font-medium">• Lịch làm việc công ty: Thứ 2 – Thứ 7 (Hệ thống tự động trừ ngày Chủ Nhật và ngày lễ).</p>
            <p className="text-emerald-800 font-medium">{calculatedDays <= 1 ? '• Đơn tối đa 1 ngày: Trưởng phòng trực tiếp phê duyệt.' : '• Đơn từ 2 ngày trở lên: Trải qua 2 cấp duyệt (Trưởng phòng duyệt trước, sau đó chuyển Giám đốc phê duyệt).'}</p>
          </div>
        )}

        <div>
          <label htmlFor="reason" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Lý do xin nghỉ phép</label>
          <textarea id="reason" name="reason" rows={4} required placeholder="Mô tả cụ thể lý do xin nghỉ phép (tối thiểu 5 ký tự)..." className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005a3c] focus:border-[#005a3c]"></textarea>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Link href="/leave" className="inline-flex items-center text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4 mr-1.5" /> Quay lại danh sách</Link>
          <SubmitButton />
        </div>
      </form>

      <RequestReviewModal
        open={reviewOpen}
        title="Kiểm tra đơn nghỉ phép"
        description="Xem lại thông tin trước khi gửi đơn."
        onClose={() => setReviewOpen(false)}
        onConfirm={confirmSubmit}
        items={[
          { label: 'Từ ngày', value: formatDate(reviewData.startDate) },
          { label: 'Đến ngày', value: formatDate(reviewData.endDate) },
          { label: 'Số ngày dự kiến', value: `${calculateDaysClient(reviewData.startDate, reviewData.endDate)} ngày`, emphasis: true },
          { label: 'Lý do nghỉ phép', value: reviewData.reason },
        ]}
      />
    </>
  );
}
