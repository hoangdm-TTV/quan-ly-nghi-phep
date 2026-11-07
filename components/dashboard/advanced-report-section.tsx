import { BarChart3, Clock3, FileWarning, UsersRound } from "lucide-react";
import Link from "next/link";
import type { HrAdvancedReport } from "@/lib/dashboard/queries";

function formatNumber(value: number, digits = 1) {
  return Number(value.toFixed(digits)).toLocaleString("vi-VN");
}

export default function AdvancedReportSection({
  report,
  reportFrom,
  reportTo,
  entitlementYear,
}: {
  report: HrAdvancedReport;
  reportFrom?: string;
  reportTo?: string;
  entitlementYear: number;
}) {
  const buildDetailsHref = (
    type: string,
    status?: string,
    late = false,
    actualTracking = false,
  ) => {
    const params = new URLSearchParams({ type, scope: "report" });
    if (status) params.set("status", status);
    if (late) params.set("late", "1");
    if (actualTracking) params.set("actual", "1");
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    return `/dashboard/details?${params.toString()}`;
  };
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">
            Báo cáo quản trị chi tiết
          </h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Số liệu được giới hạn theo phạm vi phòng ban/team của tài khoản đang
            đăng nhập.
          </p>
        </div>
        <BarChart3 className="hidden h-5 w-5 text-[#005a3c] sm:block" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href={buildDetailsHref("approval")} className="rounded-xl border border-violet-200 bg-violet-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700">
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800">
            Duyệt trung bình
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {formatNumber(report.averageApprovalHours)}h
          </p>
          <p className="mt-1 text-xs text-slate-600">Từ lúc tạo đến xử lý</p>
          <p className="mt-2 text-[11px] font-semibold text-violet-800">Xem lịch sử xử lý →</p>
        </Link>
        <Link href={`/employees?missingEntitlementYear=${entitlementYear}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
            Chưa cấp hạn mức
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {report.employeesWithoutEntitlement}
          </p>
          <p className="mt-1 text-xs text-slate-600">Nhân sự đang hoạt động</p>
          <p className="mt-2 text-[11px] font-semibold text-amber-800">Xem danh sách nhân sự →</p>
        </Link>
        <Link href={buildDetailsHref("out-office", "COMPLETED", true)} className="rounded-xl border border-rose-200 bg-rose-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700">
          <p className="text-[11px] font-bold uppercase tracking-wide text-rose-800">
            Về muộn
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {report.lateOutOfficeReturns}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Theo lúc xác nhận hoàn tất
          </p>
          <p className="mt-2 text-[11px] font-semibold text-rose-800">Xem các lượt về muộn →</p>
        </Link>
        <Link
          href={buildDetailsHref("out-office", "COMPLETED", false, true)}
          className="group rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-900">
              Theo dõi thực tế
            </p>
            <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200">
              {report.actualTracking.completedCount} đã xác nhận
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-black tabular-nums text-slate-900">
              {report.actualTracking.completedCount}
            </p>
            <p className="text-xs text-slate-600">lượt hoàn tất</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-900">
              Đúng/trước giờ: {report.actualTracking.onTimeCount}
            </span>
            <span className="rounded-md bg-rose-100 px-2 py-1 text-rose-900">
              Muộn: {report.actualTracking.lateCount}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-600">
            Giờ thực tế lấy từ lúc người duyệt xác nhận hoàn tất.
          </p>
          <p className="mt-1 text-[11px] font-semibold text-sky-900 group-hover:underline">
            Xem đối chiếu giờ hẹn và giờ xác nhận →
          </p>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-[#005a3c]" />
            <h3 className="text-sm font-bold text-slate-900">
              Tỷ trọng nghỉ theo tháng
            </h3>
          </div>
          {report.monthlyLeave.length === 0 ? (
            <p className="text-xs text-slate-400">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-3">
              {report.monthlyLeave.map((item) => (
                <div key={item.month}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {item.month}
                    </span>
                    <span className="text-slate-500">
                      {item.requests} đơn · {formatNumber(item.approvedDays)}{" "}
                      ngày · {formatNumber(item.leaveRate)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#005a3c]"
                      style={{
                        width: `${Math.max(item.leaveRate ? 4 : 0, item.leaveRate)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-[#005a3c]" />
            <h3 className="text-sm font-bold text-slate-900">
              Top nhân viên nghỉ nhiều
            </h3>
          </div>
          {report.topLeaveEmployees.length === 0 ? (
            <p className="text-xs text-slate-400">Chưa có dữ liệu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="pb-2">Nhân viên</th>
                    <th className="pb-2">Phòng ban</th>
                    <th className="pb-2 text-right">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.topLeaveEmployees.map((item) => (
                    <tr key={`${item.employeeName}-${item.departmentName}`}>
                      <td className="py-2 font-semibold text-slate-800">
                        {item.employeeName}
                      </td>
                      <td className="py-2 text-slate-500">
                        {item.departmentName}
                      </td>
                      <td className="py-2 text-right font-bold text-[#005a3c]">
                        {formatNumber(item.leaveDays)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Đơn đang chờ theo cấp xử lý
            </h3>
          </div>
          {report.pendingByLevel.length === 0 ? (
            <p className="text-xs text-slate-400">Không có đơn đang chờ.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {report.pendingByLevel.map((item) => (
                <div
                  key={item.level}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
                >
                  <span className="text-xs text-slate-600">{item.level}</span>
                  <span className="text-lg font-black text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
