"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import LeaveDocumentForm from "@/components/leave/leave-document-form";

export default function LeaveDocumentDialog({
  requestId,
}: {
  requestId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-lg border border-[#005a3c] bg-[#005a3c] px-3 py-1.5 text-sm font-bold md:min-h-0 md:text-xs text-white shadow-xs transition-colors hover:bg-[#044e3f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        Nộp giấy
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center whitespace-normal bg-slate-950/50 p-4 text-left"
          // Popup nằm trong hàng bảng bấm được: chặn click lan lên để không mở trang chi tiết.
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`leave-document-title-${requestId}`}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2
                  id={`leave-document-title-${requestId}`}
                  className="text-base font-bold text-slate-900"
                >
                  Nộp giấy nghỉ phép đã ký
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Chọn ảnh hoặc PDF để hoàn tất đơn nghỉ phép.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng popup"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:h-9 sm:w-9"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <LeaveDocumentForm requestId={requestId} compact />
          </section>
        </div>
      )}
    </>
  );
}
