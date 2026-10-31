"use client";

import { X, CheckCircle2, Pencil } from "lucide-react";
import type { ReactNode } from "react";

type ReviewItem = {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
};

type RequestReviewModalProps = {
  open: boolean;
  title: string;
  description: string;
  items: ReviewItem[];
  onClose: () => void;
  onConfirm: () => void;
};

export default function RequestReviewModal({
  open,
  title,
  description,
  items,
  onClose,
  onConfirm,
}: RequestReviewModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-review-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#005a3c]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="request-review-title"
                className="text-lg font-bold text-slate-900"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng popup xem lại"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/70">
            {items.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[minmax(140px,0.38fr)_1fr] sm:gap-4"
              >
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {item.label}
                </dt>
                <dd
                  className={`whitespace-pre-wrap break-words text-sm ${item.emphasis ? "font-bold text-[#005a3c]" : "font-medium text-slate-900"}`}
                >
                  {item.value || "—"}
                </dd>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-3 text-xs font-medium text-amber-900">
            Vui lòng kiểm tra kỹ các thông tin trên. Sau khi xác nhận, đơn sẽ
            được gửi đến người duyệt.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Quay lại chỉnh sửa
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-xl bg-[#005a3c] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#044e3f] focus:outline-none focus:ring-2 focus:ring-[#005a3c] focus:ring-offset-2"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Xác nhận gửi đơn
          </button>
        </div>
      </div>
    </div>
  );
}
