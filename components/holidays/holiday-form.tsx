"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createHolidayAction,
  updateHolidayAction,
  HolidayActionState,
} from "@/lib/holidays/actions";
import { Calendar, AlertCircle, Loader2, Send, X } from "lucide-react";

interface HolidayFormProps {
  mode: "create" | "edit";
  holiday?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
  };
  onCancel: () => void;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-semibold rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? (
        <>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          Đang lưu...
        </>
      ) : (
        <>
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {label}
        </>
      )}
    </button>
  );
}

export default function HolidayForm({
  mode,
  holiday,
  onCancel,
}: HolidayFormProps) {
  const action = mode === "create" ? createHolidayAction : updateHolidayAction;
  const initialState: HolidayActionState = {};
  const [state, formAction] = useFormState(action, initialState);

  const [name, setName] = useState(holiday?.name || "");
  const [startDate, setStartDate] = useState(holiday?.start_date || "");
  const [endDate, setEndDate] = useState(holiday?.end_date || "");
  const [isActive, setIsActive] = useState(holiday ? holiday.is_active : true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            {mode === "create" ? "Thêm ngày lễ mới" : "Chỉnh sửa ngày lễ"}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          {state.error && (
            <div className="flex items-center p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {mode === "edit" && holiday && (
            <input type="hidden" name="id" value={holiday.id} />
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Tên ngày lễ
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Tết Nguyên Đán, Ngày Quốc khánh..."
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Từ ngày
              </label>
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
            <div>
              <label
                htmlFor="endDate"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Đến ngày
              </label>
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

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Áp dụng (bật/tắt ngày lễ)</span>
            </label>
          </div>

          {startDate && endDate && endDate >= startDate && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
              {startDate === endDate ? (
                <p>
                  Ngày lễ 1 ngày:{" "}
                  <span className="font-semibold">{startDate}</span>
                </p>
              ) : (
                <p>
                  Ngày lễ từ <span className="font-semibold">{startDate}</span>{" "}
                  đến <span className="font-semibold">{endDate}</span> (
                  {Math.round(
                    (new Date(endDate).getTime() -
                      new Date(startDate).getTime()) /
                      86400000,
                  ) + 1}{" "}
                  ngày)
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Hủy
            </button>
            <SubmitButton
              label={mode === "create" ? "Thêm ngày lễ" : "Lưu thay đổi"}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
