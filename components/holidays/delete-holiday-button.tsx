"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import {
  deleteHolidayAction,
  HolidayActionState,
} from "@/lib/holidays/actions";
import { Trash2, AlertCircle, Loader2 } from "lucide-react";

interface DeleteHolidayButtonProps {
  holidayId: string;
  holidayName: string;
}

export default function DeleteHolidayButton({
  holidayId,
  holidayName,
}: DeleteHolidayButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initialState: HolidayActionState = {};
  const [state, formAction] = useFormState(deleteHolidayAction, initialState);

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
        title="Xóa ngày lễ"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Xác nhận xóa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bạn có chắc muốn xóa ngày lễ &ldquo;{holidayName}&rdquo;?
                </p>
              </div>
            </div>

            {state.error && (
              <div className="flex items-center p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <form
              action={formAction}
              onSubmit={() => startTransition(() => {})}
              className="flex items-center justify-end gap-2"
            >
              <input type="hidden" name="id" value={holidayId} />
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Xóa
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
