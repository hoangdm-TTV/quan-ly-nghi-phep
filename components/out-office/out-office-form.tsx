'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createOutOfficeRequestAction, OutOfficeActionState } from '@/lib/out-office/actions';
import { AlertCircle, Loader2, ArrowLeft, Send, Clock, Briefcase, UserCheck } from 'lucide-react';
import Link from 'next/link';

function calculateHoursClient(start: string, end: string): number {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;

  const startMin = h1 * 60 + m1;
  const endMin = h2 * 60 + m2;
  if (endMin <= startMin) return 0;

  return Math.round(((endMin - startMin) / 60) * 100) / 100;
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
          Gửi đơn xin ra ngoài
        </>
      )}
    </button>
  );
}

export default function OutOfficeForm() {
  const initialState: OutOfficeActionState = {};
  const [state, formAction] = useFormState(createOutOfficeRequestAction, initialState);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const [requestDate, setRequestDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reasonType, setReasonType] = useState<'WORK' | 'PERSONAL'>('WORK');

  const diffHours = calculateHoursClient(startTime, endTime);

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
      {state.error && (
        <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Thông báo quy trình công ty */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
        <p className="font-semibold text-amber-900">
          Quy trình ra ngoài (Gate Pass):
        </p>
        <p>1. <strong>Trước khi đi:</strong> Gửi đơn để Trưởng phòng trực tiếp (manager_id) hoặc Giám đốc duyệt.</p>
        <p>2. <strong>Sau khi về:</strong> Trưởng phòng hoặc Giám đốc xác nhận hoàn tất đơn.</p>
      </div>

      <div>
        <label htmlFor="requestDate" className="block text-sm font-medium text-slate-700 mb-1">
          Ngày xin ra ngoài
        </label>
        <input
          id="requestDate"
          name="requestDate"
          type="date"
          required
          value={requestDate}
          onChange={(e) => setRequestDate(e.target.value)}
          className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 mb-1">
            Giờ bắt đầu đi
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-slate-700 mb-1">
            Giờ kết thúc dự kiến
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {startTime && endTime && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 text-blue-600" />
            Thời gian ra ngoài dự kiến:
          </span>
          <span className="font-bold text-sm text-blue-700">
            {diffHours > 0 ? `${diffHours} giờ` : 'Giờ kết thúc phải sau giờ bắt đầu'}
          </span>
        </div>
      )}

      {/* Loại lý do */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Mục đích ra ngoài
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
              reasonType === 'WORK'
                ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="reasonType"
              value="WORK"
              checked={reasonType === 'WORK'}
              onChange={() => setReasonType('WORK')}
              className="text-blue-600 focus:ring-blue-500"
            />
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>Việc công (WORK)</span>
          </label>

          <label
            className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
              reasonType === 'PERSONAL'
                ? 'bg-purple-50 border-purple-300 text-purple-900 font-medium'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="reasonType"
              value="PERSONAL"
              checked={reasonType === 'PERSONAL'}
              onChange={() => setReasonType('PERSONAL')}
              className="text-purple-600 focus:ring-purple-500"
            />
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span>Việc riêng (PERSONAL)</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
          Nội dung lý do cụ thể
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          placeholder="VD: Đi gặp khách hàng A tại Quận 1 / Đi giải quyết thủ tục cá nhân..."
          className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        ></textarea>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <Link
          href="/out-office"
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
