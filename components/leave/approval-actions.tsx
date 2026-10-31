"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
  LeaveActionState,
} from "@/lib/leave/actions";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface ApprovalActionsProps {
  requestId: string;
}

function ApproveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
    >
      {pending ? (
        <>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          Đang duyệt...
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          Đồng ý phê duyệt
        </>
      )}
    </button>
  );
}

function RejectBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors"
    >
      {pending ? (
        <>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          Đang xử lý...
        </>
      ) : (
        <>
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          Xác nhận từ chối
        </>
      )}
    </button>
  );
}

export default function ApprovalActions({ requestId }: ApprovalActionsProps) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");

  const initialApproveState: LeaveActionState = {};
  const [approveState, approveAction] = useFormState(
    approveLeaveRequestAction,
    initialApproveState,
  );

  const initialRejectState: LeaveActionState = {};
  const [rejectState, rejectAction] = useFormState(
    rejectLeaveRequestAction,
    initialRejectState,
  );

  return (
    <div className="space-y-3">
      {approveState.error && (
        <div className="flex items-center p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
          <span>{approveState.error}</span>
        </div>
      )}
      {rejectState.error && (
        <div className="flex items-center p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
          <span>{rejectState.error}</span>
        </div>
      )}

      {mode === "idle" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("approve")}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Phê duyệt
          </button>
          <button
            onClick={() => setMode("reject")}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5 mr-1.5" />
            Từ chối
          </button>
        </div>
      )}

      {mode === "approve" && (
        <form
          action={approveAction}
          className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2.5"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <div>
            <label className="block text-xs font-medium text-emerald-900 mb-1">
              Ghi chú phê duyệt (tùy chọn):
            </label>
            <input
              type="text"
              name="comment"
              placeholder="VD: Đồng ý cho nghỉ phép..."
              className="block w-full px-2.5 py-1.5 border border-emerald-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <ApproveBtn />
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <form
          action={rejectAction}
          className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg space-y-2.5"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <div>
            <label className="block text-xs font-medium text-rose-900 mb-1">
              Lý do từ chối <span className="text-rose-600">*</span>:
            </label>
            <textarea
              name="rejectionReason"
              required
              rows={2}
              placeholder="Vui lòng nhập lý do từ chối cụ thể (tối thiểu 5 ký tự)..."
              className="block w-full px-2.5 py-1.5 border border-rose-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
            ></textarea>
          </div>
          <div className="flex items-center gap-2">
            <RejectBtn />
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
