import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { canViewRequestScope } from "@/lib/auth/roles";
import {
  getScopedLeaveRequests,
  getVisibleLeaveRequests,
} from "@/lib/leave/queries";
import {
  getScopedOutOfficeRequests,
  getVisibleOutOfficeRequests,
} from "@/lib/out-office/queries";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  if (type !== "leave" && type !== "out-office")
    return new NextResponse("Invalid report type", { status: 400 });
  const status = params.get("status") || undefined;
  const fromDate = validDate(params.get("from"));
  const toDate = validDate(params.get("to"));
  const hasScope = canViewRequestScope(user.role);
  const uuid = (value: string | null) =>
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : undefined;
  const employeeId = hasScope ? uuid(params.get("employeeId")) : undefined;
  const departmentId = hasScope ? uuid(params.get("departmentId")) : undefined;
  const teamId = hasScope ? uuid(params.get("teamId")) : undefined;
  const columns =
    type === "leave"
      ? [
          "Mã đơn",
          "Nhân viên",
          "Email",
          "Phòng ban",
          "Team",
          "Từ ngày",
          "Đến ngày",
          "Số ngày",
          "Trạng thái",
          "Lý do",
          "Người duyệt",
          "Lý do từ chối",
        ]
      : [
          "Mã đơn",
          "Nhân viên",
          "Email",
          "Phòng ban",
          "Team",
          "Ngày",
          "Từ giờ",
          "Đến giờ",
          "Số giờ",
          "Mục đích",
          "Trạng thái",
          "Lý do",
          "Người duyệt",
          "Lý do từ chối",
        ];
  let records: unknown[][];
  if (type === "leave") {
    const rows = hasScope
      ? await getScopedLeaveRequests(user, {
          status,
          fromDate,
          toDate,
          employeeId,
          departmentId,
          teamId,
        })
      : await getVisibleLeaveRequests(user, status);
    const selected = hasScope
      ? rows
      : rows.filter(
          (r) =>
            (!fromDate || r.start_date >= fromDate) &&
            (!toDate || r.start_date <= toDate),
        );
    records = selected.map((r) => [
      r.id,
      r.employee_name,
      r.employee_email,
      r.department_name,
      r.team_name,
      r.start_date,
      r.end_date,
      r.duration_days,
      r.status,
      r.reason,
      r.approver_name,
      r.rejection_reason,
    ]);
  } else {
    const rows = hasScope
      ? await getScopedOutOfficeRequests(user, {
          status,
          fromDate,
          toDate,
          employeeId,
          departmentId,
          teamId,
        })
      : await getVisibleOutOfficeRequests(user, status);
    const selected = hasScope
      ? rows
      : rows.filter(
          (r) =>
            (!fromDate || r.request_date >= fromDate) &&
            (!toDate || r.request_date <= toDate),
        );
    records = selected.map((r) => [
      r.id,
      r.employee_name,
      r.employee_email,
      r.department_name,
      r.team_name,
      r.request_date,
      r.start_time,
      r.end_time,
      r.estimated_hours,
      r.reason_type,
      r.status,
      r.reason,
      r.approver_name,
      r.rejection_reason,
    ]);
  }
  const csv =
    "\uFEFF" +
    [columns, ...records].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const filename = type === "leave" ? "don-nghi-phep.csv" : "don-ra-ngoai.csv";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
