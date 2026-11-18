import { CalendarDays, Clock3, UsersRound } from "lucide-react";
import Link from "next/link";
import type {
  AbsenceTrendGrouping,
  AbsenceTrendItem,
  HrAdvancedReport,
  ScopeReport,
} from "@/lib/dashboard/queries";

function formatNumber(value: number, digits = 0) {
  return Number(value.toFixed(digits)).toLocaleString("vi-VN");
}

export default function AdvancedReportSection({
  report,
  scopeReport,
  trend,
  trendGrouping,
  reportFrom,
  reportTo,
}: {
  report: HrAdvancedReport;
  scopeReport: ScopeReport;
  trend: AbsenceTrendItem[];
  trendGrouping: AbsenceTrendGrouping;
  reportFrom?: string;
  reportTo?: string;
}) {
  const maxTrendEmployees = Math.max(
    1,
    ...trend.map((item) =>
      Math.max(item.leaveEmployees, item.outOfficeEmployees),
    ),
  );
  const departments = [...scopeReport.departments].sort(
    (a, b) => b.leaveEmployees - a.leaveEmployees,
  );
  const maxDepartmentEmployees = Math.max(
    1,
    ...departments.map((item) =>
      Math.max(item.leaveEmployees, item.outOfficeEmployees),
    ),
  );
  const groupingLabel = {
    day: "ngày",
    month: "tháng",
    year: "năm",
  }[trendGrouping];
  const groupingHref = (grouping: AbsenceTrendGrouping) => {
    const params = new URLSearchParams({ groupBy: grouping });
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    return `/?${params.toString()}`;
  };
  const leaveDetailsHref = (
    fromDate = reportFrom,
    toDate = reportTo,
    employeeId?: string,
    departmentId?: string | null,
  ) => {
    const params = new URLSearchParams({
      type: "leave",
      status: "APPROVED_GROUP",
      scope: "report",
    });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (employeeId) params.set("employeeId", employeeId);
    if (departmentId !== undefined) {
      params.set("departmentId", departmentId ?? "none");
    }
    return `/dashboard/details?${params.toString()}`;
  };
  const leaveRequestDetailsHref = (requestId: string) => {
    const params = new URLSearchParams({
      type: "leave",
      status: "APPROVED_GROUP",
      scope: "report",
      requestId,
    });
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    return `/dashboard/details?${params.toString()}`;
  };
  const outOfficeDetailsHref = (
    status: string,
    late = false,
    actual = false,
    fromDate = reportFrom,
    toDate = reportTo,
    employeeId?: string,
    departmentId?: string | null,
  ) => {
    const params = new URLSearchParams({
      type: "out-office",
      status,
      scope: "report",
    });
    if (late) params.set("late", "1");
    if (actual) params.set("actual", "1");
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (employeeId) params.set("employeeId", employeeId);
    if (departmentId !== undefined) {
      params.set("departmentId", departmentId ?? "none");
    }
    return `/dashboard/details?${params.toString()}`;
  };
  const outOfficeRequestDetailsHref = (requestId: string) => {
    const params = new URLSearchParams({
      type: "out-office",
      status: "COMPLETED",
      scope: "report",
      late: "1",
      actual: "1",
      requestId,
    });
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    return `/dashboard/details?${params.toString()}`;
  };
  const longLeaveDetailsHref = () => {
    const params = new URLSearchParams({
      type: "leave",
      status: "APPROVED_GROUP",
      scope: "report",
      long: "1",
    });
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    return `/dashboard/details?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Số nhân viên nghỉ theo thời gian
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Số người trong kỳ · {trendGrouping === "month" ? "theo tháng" : `theo ${groupingLabel}`}
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
              {(["day", "month", "year"] as const).map((grouping) => (
                <Link
                  key={grouping}
                  href={groupingHref(grouping)}
                  aria-current={trendGrouping === grouping ? "true" : undefined}
                  className={`rounded-md px-3 py-1.5 ${
                    trendGrouping === grouping
                      ? "bg-emerald-50 font-semibold text-emerald-800"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {grouping === "day"
                    ? "Ngày"
                    : grouping === "month"
                      ? "Tháng"
                      : "Năm"}
                </Link>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-4 text-[11px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
              Nghỉ phép
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Ra ngoài
            </span>
          </div>
          {trend.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">
              Chưa có dữ liệu trong kỳ.
            </p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-end gap-3 border-b border-l border-slate-200 px-3 pb-2">
                {trend.map((item) => (
                  <div
                    key={item.period}
                    className="flex w-14 shrink-0 flex-col items-center"
                    title={`${item.period}: nghỉ phép ${item.leaveEmployees} người, ${item.leaveRequests} đơn; ra ngoài ${item.outOfficeEmployees} người, ${item.outOfficeRequests} đơn`}
                  >
                    <div className="flex h-36 items-end gap-1">
                      <Link
                        href={leaveDetailsHref(item.fromDate, item.toDate)}
                        aria-label={`Xem đơn nghỉ phép ${item.period}`}
                        className="flex h-full w-5 flex-col items-center justify-end rounded-t hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <span className="mb-1 text-[9px] text-blue-700">
                          {item.leaveEmployees}
                        </span>
                        <div
                          className="w-3 rounded-t bg-blue-500"
                          style={{
                            height: `${(item.leaveEmployees / maxTrendEmployees) * 78}%`,
                            minHeight: item.leaveEmployees ? "3px" : "0",
                          }}
                        />
                      </Link>
                      <Link
                        href={outOfficeDetailsHref(
                          "TRACKED",
                          false,
                          false,
                          item.fromDate,
                          item.toDate,
                        )}
                        aria-label={`Xem đơn ra ngoài ${item.period}`}
                        className="flex h-full w-5 flex-col items-center justify-end rounded-t hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <span className="mb-1 text-[9px] text-emerald-700">
                          {item.outOfficeEmployees}
                        </span>
                        <div
                          className="w-3 rounded-t bg-emerald-500"
                          style={{
                            height: `${(item.outOfficeEmployees / maxTrendEmployees) * 78}%`,
                            minHeight: item.outOfficeEmployees ? "3px" : "0",
                          }}
                        />
                      </Link>
                    </div>
                    <span className="mt-2 whitespace-nowrap text-[9px] text-slate-500">
                      {item.period}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5">
          <div className="mb-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Theo phòng ban
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Nhân viên nghỉ phép và ra ngoài trong kỳ
            </p>
          </div>
          <div className="mb-4 flex gap-4 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Nghỉ phép
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Ra ngoài
            </span>
          </div>
          {departments.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Chưa có dữ liệu phòng ban.
            </p>
          ) : (
            <div className="space-y-4">
              {departments.map((department) => {
                const leaveHref = leaveDetailsHref(
                  reportFrom,
                  reportTo,
                  undefined,
                  department.departmentId,
                );
                const outOfficeHref = outOfficeDetailsHref(
                  "TRACKED",
                  false,
                  false,
                  reportFrom,
                  reportTo,
                  undefined,
                  department.departmentId,
                );
                const departmentHref =
                  department.leaveEmployees > 0 ? leaveHref : outOfficeHref;
                return (
                  <div key={department.departmentId || "unassigned"}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <Link
                        href={departmentHref}
                        className="truncate text-slate-600 hover:text-emerald-800 hover:underline"
                      >
                        {department.departmentName}
                      </Link>
                      <span className="flex shrink-0 items-center gap-1 font-semibold">
                        <Link
                          href={leaveHref}
                          aria-label={`Xem đơn nghỉ phép của ${department.departmentName}`}
                          className="text-emerald-800 hover:underline"
                        >
                          {department.leaveEmployees}
                        </Link>
                        <span className="font-normal text-slate-400">/</span>
                        <Link
                          href={outOfficeHref}
                          aria-label={`Xem đơn ra ngoài của ${department.departmentName}`}
                          className="text-blue-700 hover:underline"
                        >
                          {department.outOfficeEmployees}
                        </Link>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <Link
                        href={leaveHref}
                        aria-label={`Xem danh sách nghỉ phép của ${department.departmentName}`}
                        className="block h-2 overflow-hidden rounded-full bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${(department.leaveEmployees / maxDepartmentEmployees) * 100}%`,
                          }}
                        />
                      </Link>
                      <Link
                        href={outOfficeHref}
                        aria-label={`Xem danh sách ra ngoài của ${department.departmentName}`}
                        className="block h-1.5 overflow-hidden rounded-full bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <span
                          className="block h-full rounded-full bg-blue-500"
                          style={{
                            width: `${(department.outOfficeEmployees / maxDepartmentEmployees) * 100}%`,
                          }}
                        />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-5 text-[10px] text-slate-400">
            Nhân viên có đơn đã duyệt trong kỳ.
          </p>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Đơn nghỉ trên 2 ngày
              </h2>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {formatNumber(report.longLeaveCount)}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  đơn · ngày làm việc
                </span>
              </p>
            </div>
            <Link
              href={longLeaveDetailsHref()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
            >
              Xem danh sách <CalendarDays className="h-4 w-4 text-amber-600" />
            </Link>
          </div>
          {report.longLeaveRequests.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Chưa có đơn phù hợp trong kỳ.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Nhân viên</th>
                    <th className="px-3 py-2.5">Phòng ban</th>
                    <th className="px-3 py-2.5">Khoảng nghỉ</th>
                    <th className="px-3 py-2.5 text-right">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.longLeaveRequests.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        <Link href={leaveRequestDetailsHref(item.id)} className="hover:underline">
                          {item.employeeName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {item.departmentName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {item.startDate} – {item.endDate}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800">
                        {formatNumber(item.durationDays)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-[10px] text-slate-400">
            Chỉ tính các đơn nghỉ phép đã được duyệt.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-emerald-700" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Nghỉ nhiều nhất
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Xếp theo tổng ngày nghỉ đã duyệt trong kỳ.
              </p>
            </div>
          </div>
          {report.topLeaveEmployees.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Chưa có dữ liệu trong kỳ.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1.3rem_minmax(0,1fr)_3.5rem_2.5rem] gap-2 rounded-lg bg-slate-50 px-2 py-2 text-[10px] uppercase text-slate-500">
                <span>#</span>
                <span>Nhân viên</span>
                <span className="text-right">Ngày</span>
                <span className="text-right">Đơn</span>
              </div>
              {report.topLeaveEmployees.map((item, index) => (
                <Link
                  key={item.employeeId}
                  href={leaveDetailsHref(
                    reportFrom,
                    reportTo,
                    item.employeeId,
                  )}
                  className="grid grid-cols-[1.3rem_minmax(0,1fr)_3.5rem_2.5rem] items-center gap-2 border-b border-slate-100 px-2 py-3 text-xs hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <span className="text-slate-400">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">
                      {item.employeeName}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {item.departmentName}
                    </span>
                  </span>
                  <span className="text-right font-bold text-slate-800">
                    {formatNumber(item.leaveDays)}
                  </span>
                  <span className="text-right text-slate-600">
                    {formatNumber(item.leaveRequests)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-rose-600" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Theo dõi đơn ra ngoài
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Thời gian về được ghi nhận lúc nhân viên tải giấy xác nhận.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-right">
          <Link
            href={outOfficeDetailsHref("ALL")}
            className="min-w-24 rounded-lg px-2 py-1 transition hover:bg-slate-50"
          >
              <p className="text-lg font-black text-slate-900">
                {formatNumber(scopeReport.totals.outOfficeTotal)}
              </p>
              <p className="text-[10px] text-slate-500">đơn ra ngoài</p>
          </Link>
          <Link
            href={outOfficeDetailsHref("COMPLETED", false, true)}
            className="min-w-24 rounded-lg px-2 py-1 transition hover:bg-emerald-50"
          >
              <p className="text-lg font-black text-emerald-700">
                {formatNumber(report.actualTracking.completedCount)}
              </p>
              <p className="text-[10px] text-slate-500">đã xác nhận về</p>
          </Link>
          <Link
            href={outOfficeDetailsHref("COMPLETED", true)}
            className="min-w-24 rounded-lg px-2 py-1 transition hover:bg-rose-50"
          >
              <p className="text-lg font-black text-rose-700">
                {formatNumber(report.lateOutOfficeReturns)}
              </p>
              <p className="text-[10px] text-slate-500">về muộn</p>
          </Link>
          </div>
        </div>
        {report.lateOutOfficeDetails.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
            Không có lượt về muộn trong kỳ.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Nhân viên</th>
                  <th className="px-3 py-2.5">Phòng ban</th>
                  <th className="px-3 py-2.5">Ngày</th>
                  <th className="px-3 py-2.5">Giờ hẹn</th>
                  <th className="px-3 py-2.5">Giờ ghi nhận</th>
                  <th className="px-3 py-2.5 text-right">Trễ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.lateOutOfficeDetails.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      <Link
                        href={outOfficeRequestDetailsHref(item.id)}
                        className="hover:underline"
                      >
                        {item.employeeName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {item.departmentName}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.requestDate}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.scheduledEndTime}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.actualReturnAt}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-rose-700">
                      {formatNumber(item.delayMinutes)} phút
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
