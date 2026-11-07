import Link from "next/link";
import { requireAuth } from "@/lib/auth/permissions";
import { getUserDataScopeLabel } from "@/lib/auth/data-scope";
import { getApprovalMetricDetails } from "@/lib/dashboard/queries";
import { getScopedLeaveRequests } from "@/lib/leave/queries";
import { getScopedOutOfficeRequests } from "@/lib/out-office/queries";
import LeaveStatusBadge from "@/components/leave/leave-status-badge";
import OutOfficeStatusBadge from "@/components/out-office/out-office-status-badge";

function validDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

const leaveLabels: Record<string, string> = {
  ALL: "Tất cả đơn nghỉ phép",
  PENDING_GROUP: "Đơn nghỉ phép đang chờ xử lý",
  APPROVED_GROUP: "Đơn nghỉ phép đã được duyệt",
  REJECTED: "Đơn nghỉ phép bị từ chối",
  CANCELLED: "Đơn nghỉ phép đã hủy",
};
const outOfficeLabels: Record<string, string> = {
  ALL: "Tất cả đơn ra ngoài",
  PENDING: "Đơn ra ngoài đang chờ",
  TRACKED: "Đơn ra ngoài đang thực hiện hoặc đã hoàn tất",
  COMPLETED: "Đơn ra ngoài đã hoàn tất",
  REJECTED: "Đơn ra ngoài bị từ chối",
  CANCELLED: "Đơn ra ngoài đã hủy",
};

export const metadata = { title: "Chi tiết thống kê | Tri Thức Việt" };

export default async function DashboardDetailsPage({
  searchParams,
}: {
  searchParams?: {
    type?: string;
    status?: string;
    scope?: string;
    from?: string;
    to?: string;
    late?: string;
    actual?: string;
    page?: string;
  };
}) {
  const user = await requireAuth();
  const type = searchParams?.type === "out-office"
    ? "out-office"
    : searchParams?.type === "approval"
      ? "approval"
      : "leave";
  const scope = searchParams?.scope === "mine" ? "mine" : "report";
  const fromDate = validDate(searchParams?.from);
  const toDate = validDate(searchParams?.to);
  const pageNumber = Math.max(1, Math.min(100_000, Number(searchParams?.page) || 1));
  const pagination = { limit: 25, offset: (pageNumber - 1) * 25 };
  const dateDescription = fromDate || toDate
    ? ` · ${fromDate || "đầu kỳ"} → ${toDate || "hiện tại"}`
    : "";

  if (type === "approval") {
    const rows = await getApprovalMetricDetails(user, fromDate, toDate, pagination);
    const hasNext = rows.length > 25;
    const params = new URLSearchParams({ type, scope });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const pageHref = (nextPage: number) => {
      const next = new URLSearchParams(params);
      if (nextPage > 1) next.set("page", String(nextPage));
      return `/dashboard/details?${next.toString()}`;
    };
    const actionLabels: Record<string, string> = {
      APPROVED_LEAD: "Duyệt cấp 1",
      APPROVED_DIRECTOR: "Duyệt cấp 2",
      REJECTED: "Từ chối",
    };
    return (
      <main className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <Link href="/" className="text-xs font-semibold text-emerald-800 hover:underline">← Quay lại tổng quan</Link>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Chi tiết thời gian duyệt</h1>
          <p className="mt-1 text-sm text-slate-600">Lịch sử thao tác được tính trong phạm vi {getUserDataScopeLabel(user)}{dateDescription}.</p>
        </header>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Loại đơn</th>
                  <th className="px-4 py-3">Ngày đơn</th>
                  <th className="px-4 py-3">Thao tác</th>
                  <th className="px-4 py-3">Thời gian từ lúc tạo</th>
                  {user.role !== "ADMIN" && <th className="px-4 py-3">Chi tiết</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 25).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.employee_name}
                      <span className="block text-xs font-normal text-slate-500">{row.department_name || "Chưa phân bổ"}</span>
                    </td>
                    <td className="px-4 py-3">{row.request_type === "LEAVE" ? "Nghỉ phép" : "Ra ngoài"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{row.request_date}</td>
                    <td className="px-4 py-3">{actionLabels[row.action] || row.action}</td>
                    <td className="px-4 py-3">{Number(row.elapsed_hours || 0).toFixed(1)} giờ</td>
                    {user.role !== "ADMIN" && (
                      <td className="px-4 py-3">
                        <Link
                          href={row.request_type === "LEAVE" ? `/leave/${row.request_id}` : `/out-office/${row.request_id}`}
                          className="font-semibold text-emerald-800 hover:underline"
                        >Mở đơn →</Link>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={user.role === "ADMIN" ? 5 : 6} className="px-4 py-10 text-center text-sm text-slate-500">Chưa có lịch sử xử lý trong kỳ và phạm vi này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
            {pageNumber > 1 && <Link href={pageHref(pageNumber - 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Trước</Link>}
            {hasNext && <Link href={pageHref(pageNumber + 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Tiếp</Link>}
          </footer>
        </section>
      </main>
    );
  }

  const labels = type === "leave" ? leaveLabels : outOfficeLabels;
  const status = searchParams?.status && labels[searchParams.status]
    ? searchParams.status
    : "ALL";
  const title = labels[status];
  const lateReturn = type === "out-office" && searchParams?.late === "1";
  const actualTracking = type === "out-office" && searchParams?.actual === "1";
  const employeeId = scope === "mine" ? user.id : undefined;
  const listHref = (nextPage: number) => {
    const params = new URLSearchParams({ type, status, scope });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (lateReturn) params.set("late", "1");
    if (actualTracking) params.set("actual", "1");
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/dashboard/details?${params.toString()}`;
  };

  if (type === "leave") {
    const rows = await getScopedLeaveRequests(
      user,
      { status, employeeId, fromDate, toDate },
      pagination,
    );
    const hasNext = rows.length > 25;
    const requests = rows.slice(0, 25);
    return (
      <main className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <Link href="/" className="text-xs font-semibold text-emerald-800 hover:underline">← Quay lại tổng quan</Link>
          <h1 className="mt-2 text-2xl font-black text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">Phạm vi: {scope === "mine" ? "Đơn cá nhân của tôi" : getUserDataScopeLabel(user)}{dateDescription}</p>
        </header>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  {scope !== "mine" && <th className="px-4 py-3">Nhân viên</th>}
                  <th className="px-4 py-3">Thời gian nghỉ</th>
                  <th className="px-4 py-3">Số ngày</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  {user.role !== "ADMIN" && <th className="px-4 py-3">Chi tiết</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {scope !== "mine" && <td className="px-4 py-3 font-semibold text-slate-900">{row.employee_name}</td>}
                    <td className="whitespace-nowrap px-4 py-3">{row.start_date} → {row.end_date}</td>
                    <td className="px-4 py-3">{row.duration_days} ngày</td>
                    <td className="max-w-xs truncate px-4 py-3" title={row.reason || ""}>{row.reason || "—"}</td>
                    <td className="px-4 py-3"><LeaveStatusBadge status={row.status} /></td>
                    {user.role !== "ADMIN" && <td className="px-4 py-3"><Link href={`/leave/${row.id}`} className="font-semibold text-emerald-800 hover:underline">Mở đơn →</Link></td>}
                  </tr>
                ))}
                {requests.length === 0 && <tr><td colSpan={(scope === "mine" ? 4 : 5) + (user.role !== "ADMIN" ? 1 : 0)} className="px-4 py-10 text-center text-sm text-slate-500">Không có đơn phù hợp với thống kê này.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
            {pageNumber > 1 && <Link href={listHref(pageNumber - 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Trước</Link>}
            {hasNext && <Link href={listHref(pageNumber + 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Tiếp</Link>}
          </footer>
        </section>
      </main>
    );
  }

  const rows = await getScopedOutOfficeRequests(
    user,
    { status, lateReturn, actualTracking, employeeId, fromDate, toDate },
    pagination,
  );
  const hasNext = rows.length > 25;
  const requests = rows.slice(0, 25);
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <Link href="/" className="text-xs font-semibold text-emerald-800 hover:underline">← Quay lại tổng quan</Link>
        <h1 className="mt-2 text-2xl font-black text-slate-900">{actualTracking ? "Theo dõi thực tế đơn ra ngoài" : lateReturn ? "Chi tiết lượt ra ngoài về muộn" : title}</h1>
        <p className="mt-1 text-sm text-slate-600">Phạm vi: {scope === "mine" ? "Đơn cá nhân của tôi" : getUserDataScopeLabel(user)}{dateDescription}</p>
        {actualTracking && <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">Thời điểm thực tế ở đây là lúc người duyệt xác nhận hoàn tất trên hệ thống; giờ hẹn được lấy từ đơn đăng ký. Ghi chú xác nhận được hiển thị nếu có.</p>}
      </header>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
              <tr>
                {scope !== "mine" && <th className="px-4 py-3">Nhân viên</th>}
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Giờ đăng ký</th>
                {(lateReturn || actualTracking) && <th className="px-4 py-3">Thời điểm xác nhận</th>}
                {actualTracking && <th className="px-4 py-3">Chênh lệch với giờ hẹn</th>}
                <th className="px-4 py-3">Mục đích</th>
                {actualTracking && <th className="px-4 py-3">Ghi chú xác nhận</th>}
                <th className="px-4 py-3">Trạng thái</th>
                {user.role !== "ADMIN" && <th className="px-4 py-3">Chi tiết</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  {scope !== "mine" && <td className="px-4 py-3 font-semibold text-slate-900">{row.employee_name}</td>}
                  <td className="whitespace-nowrap px-4 py-3">{row.request_date}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.start_time}–{row.end_time}</td>
                  {(lateReturn || actualTracking) && <td className="whitespace-nowrap px-4 py-3">{row.actual_return_at || new Date(row.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>}
                  {actualTracking && <td className="whitespace-nowrap px-4 py-3">{Number(row.return_delta_minutes || 0) > 0 ? <span className="font-semibold text-rose-700">Muộn {Math.floor(Number(row.return_delta_minutes) / 60) ? `${Math.floor(Number(row.return_delta_minutes) / 60)} giờ ` : ""}{Number(row.return_delta_minutes) % 60} phút</span> : <span className="font-semibold text-emerald-800">Đúng/trước giờ</span>}</td>}
                  <td className="max-w-xs truncate px-4 py-3" title={row.reason || ""}>{row.reason || "—"}</td>
                  {actualTracking && <td className="max-w-sm px-4 py-3 text-xs text-slate-600">{row.completion_comment || "Không có ghi chú"}</td>}
                  <td className="px-4 py-3"><OutOfficeStatusBadge status={row.status} /></td>
                  {user.role !== "ADMIN" && <td className="px-4 py-3"><Link href={`/out-office/${row.id}`} className="font-semibold text-emerald-800 hover:underline">Mở đơn →</Link></td>}
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={(scope === "mine" ? 4 : 5) + (lateReturn || actualTracking ? 1 : 0) + (actualTracking ? 2 : 0) + (user.role !== "ADMIN" ? 1 : 0)} className="px-4 py-10 text-center text-sm text-slate-500">Chưa có đơn đã xác nhận hoàn tất trong phạm vi và kỳ lọc này.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          {pageNumber > 1 && <Link href={listHref(pageNumber - 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Trước</Link>}
          {hasNext && <Link href={listHref(pageNumber + 1)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Tiếp</Link>}
        </footer>
      </section>
    </main>
  );
}
