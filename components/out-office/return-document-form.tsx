"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import {
  uploadOutOfficeReturnDocumentAction,
} from "@/lib/out-office/actions";

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-[#005a3c] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#044e3f] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Đang tải giấy lên...
        </>
      ) : (
        <>
          <Upload className="mr-1.5 h-4 w-4" />
          Nộp giấy xác nhận đã về
        </>
      )}
    </button>
  );
}

export default function ReturnDocumentForm({
  requestId,
}: {
  requestId: string;
}) {
  const [state, formAction] = useFormState(
    uploadOutOfficeReturnDocumentAction,
    {},
  );

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3 rounded-xl border border-teal-200 bg-white p-5"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label
          htmlFor={`out-office-return-document-${requestId}`}
          className="mb-1 block text-xs font-semibold text-slate-800"
        >
          Ảnh hoặc PDF giấy xác nhận khi về
        </label>
        <input
          id={`out-office-return-document-${requestId}`}
          name="documentFile"
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          required
          className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#005a3c]"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Chấp nhận PDF tối đa 50 MB hoặc ảnh PNG/JPEG tối đa 5 MB. Thời điểm
          tải giấy lên sẽ được ghi nhận làm giờ về thực tế.
        </p>
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
