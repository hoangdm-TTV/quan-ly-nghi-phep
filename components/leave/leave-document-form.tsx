'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import { uploadLeaveDocumentAction, LeaveActionState } from '@/lib/leave/actions';

function UploadButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Đang tải giấy lên...
        </>
      ) : (
        <>
          <Upload className="mr-1.5 h-4 w-4" />
          Nộp giấy đã ký
        </>
      )}
    </button>
  );
}

export default function LeaveDocumentForm({ requestId }: { requestId: string }) {
  const initialState: LeaveActionState = {};
  const [state, formAction] = useFormState(uploadLeaveDocumentAction, initialState);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3 rounded-xl border border-teal-200 bg-white p-5"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label htmlFor="signed-leave-document" className="mb-1 block text-xs font-semibold text-slate-800">
          Ảnh hoặc PDF giấy xin nghỉ đã ký
        </label>
        <input
          id="signed-leave-document"
          name="documentFile"
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          required
          className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-700"
        />
        <p className="mt-1 text-[11px] text-slate-500">PDF, PNG hoặc JPEG; tối đa 5 MB. Tệp chỉ người có quyền xem đơn mới tải được.</p>
      </div>

      {state.error && (
        <div className="flex items-center rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="mr-1.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <UploadButton />
    </form>
  );
}
