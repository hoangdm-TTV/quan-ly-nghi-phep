'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cancelPendingOutOfficeRequestAction, updatePendingOutOfficeRequestAction } from '@/lib/out-office/actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-lg bg-[#005a3c] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? 'Đang lưu...' : 'Lưu thay đổi'}</button>;
}

export default function PendingOutOfficeEditor({ request }: {
  request: { id: string; request_date: string; start_time: string; end_time: string; reason_type: 'WORK' | 'PERSONAL'; reason: string | null };
}) {
  const router = useRouter();
  const [editState, editAction] = useFormState(updatePendingOutOfficeRequestAction, {});
  const [cancelState, cancelAction] = useFormState(cancelPendingOutOfficeRequestAction, {});
  useEffect(() => { if (editState.success || cancelState.success) router.refresh(); }, [editState.success, cancelState.success, router]);
  return <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
    <div><h3 className="text-sm font-bold text-amber-950">Chỉnh sửa hoặc hủy đơn</h3><p className="mt-1 text-xs text-amber-900">Chỉ áp dụng khi đơn còn đang chờ duyệt. Thay đổi sẽ được lưu vào lịch sử.</p></div>
    <form action={editAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="requestId" value={request.id} />
      <label className="text-xs font-semibold text-slate-700">Ngày<input required type="date" name="requestDate" defaultValue={request.request_date} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
      <label className="text-xs font-semibold text-slate-700">Mục đích<select name="reasonType" defaultValue={request.reason_type} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"><option value="WORK">Việc công</option><option value="PERSONAL">Việc riêng</option></select></label>
      <label className="text-xs font-semibold text-slate-700">Từ giờ<input required type="time" name="startTime" defaultValue={request.start_time} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
      <label className="text-xs font-semibold text-slate-700">Đến giờ<input required type="time" name="endTime" defaultValue={request.end_time} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
      <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Lý do<textarea required minLength={5} maxLength={1000} name="reason" defaultValue={request.reason || ''} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
      {editState.error && <p className="text-xs text-rose-700 sm:col-span-2">{editState.error}</p>}
      {editState.success && <p className="text-xs text-emerald-700 sm:col-span-2">Đã cập nhật đơn.</p>}
      <div className="sm:col-span-2"><SaveButton /></div>
    </form>
    <form action={cancelAction} onSubmit={(event) => { if (!window.confirm('Bạn có chắc muốn hủy đơn này?')) event.preventDefault(); }}>
      <input type="hidden" name="requestId" value={request.id} />
      {cancelState.error && <p className="mb-2 text-xs text-rose-700">{cancelState.error}</p>}
      <button className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700">Hủy đơn ra ngoài</button>
    </form>
  </section>;
}
