import { query } from "@/lib/db/pool";
import { SafeUser } from "@/lib/types/user";
import {
  buildReportDataScope,
  buildUserDataScope,
} from "@/lib/auth/data-scope";

export interface ScopeReportDepartment {
  departmentId: string | null;
  departmentName: string;
  leaveTotal: number;
  leaveEmployees: number;
  leavePending: number;
  leaveApproved: number;
  leaveRejected: number;
  leaveCancelled: number;
  leaveDays: number;
  outOfficeTotal: number;
  outOfficeEmployees: number;
  outOfficePending: number;
  outOfficeApproved: number;
  outOfficeCompleted: number;
  outOfficeRejected: number;
  outOfficeCancelled: number;
  outOfficeHours: number;
}

export interface ScopeReport {
  departments: ScopeReportDepartment[];
  totals: Omit<ScopeReportDepartment, "departmentId" | "departmentName">;
}

export interface DashboardStats {
  // Thống kê đơn nghỉ phép cá nhân
  myLeaveTotal: number;
  myLeavePending: number;
  myLeaveApproved: number;
  myLeaveRejected: number;

  // Thống kê đơn ra ngoài cá nhân
  myOutOfficeTotal: number;
  myOutOfficePending: number;
  myOutOfficeActive: number;
  myOutOfficeCompleted: number;

}

export interface RecentActivityItem {
  id: string;
  type: "LEAVE" | "OUT_OFFICE";
  title: string;
  subtitle: string;
  dateInfo: string;
  status: string;
  createdAt: Date;
  link: string;
}

/**
 * Lấy các chỉ số thống kê thực tế từ PostgreSQL cho người dùng hiện tại
 */
export async function getDashboardStats(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
): Promise<DashboardStats> {
  const leaveParams: unknown[] = [user.id];
  const leaveConditions = ["employee_id = $1"];
  const outOfficeParams: unknown[] = [user.id];
  const outOfficeConditions = ["employee_id = $1"];
  if (fromDate) {
    leaveParams.push(fromDate);
    leaveConditions.push(`end_date >= $${leaveParams.length}`);
    outOfficeParams.push(fromDate);
    outOfficeConditions.push(`request_date >= $${outOfficeParams.length}`);
  }
  if (toDate) {
    leaveParams.push(toDate);
    leaveConditions.push(`start_date <= $${leaveParams.length}`);
    outOfficeParams.push(toDate);
    outOfficeConditions.push(`request_date <= $${outOfficeParams.length}`);
  }

  // 1. Thống kê đơn nghỉ phép cá nhân
  const leaveStatsQuery = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status IN ('PENDING', 'APPROVED_BY_LEAD') THEN 1 END)::int AS pending,
      COUNT(CASE WHEN status IN ('WAITING_FOR_DOC', 'COMPLETED') THEN 1 END)::int AS approved,
      COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int AS rejected
    FROM leave_requests
    WHERE ${leaveConditions.join(" AND ")}
  `;

  // 2. Thống kê đơn ra ngoài cá nhân
  const outOfficeStatsQuery = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending,
      COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int AS active,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed
    FROM out_office_requests
    WHERE ${outOfficeConditions.join(" AND ")}
  `;

  const [leaveRes, outOfficeRes] = await Promise.all([
    query(leaveStatsQuery, leaveParams),
    query(outOfficeStatsQuery, outOfficeParams),
  ]);

  const leaveRow = leaveRes.rows[0] || {};
  const outOfficeRow = outOfficeRes.rows[0] || {};

  return {
    myLeaveTotal: leaveRow.total || 0,
    myLeavePending: leaveRow.pending || 0,
    myLeaveApproved: leaveRow.approved || 0,
    myLeaveRejected: leaveRow.rejected || 0,

    myOutOfficeTotal: outOfficeRow.total || 0,
    myOutOfficePending: outOfficeRow.pending || 0,
    myOutOfficeActive: outOfficeRow.active || 0,
    myOutOfficeCompleted: outOfficeRow.completed || 0,
  };
}

/** Báo cáo tổng hợp trong cùng phạm vi dữ liệu áp dụng cho danh sách đơn. */
export async function getScopeReport(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
): Promise<ScopeReport> {
  const scope = buildReportDataScope(user, "u");
  const leaveParams = [...scope.params];
  const leaveFilters = [scope.whereSql];
  if (fromDate) {
    leaveParams.push(fromDate);
    leaveFilters.push(`lr.end_date >= $${leaveParams.length}`);
  }
  if (toDate) {
    leaveParams.push(toDate);
    leaveFilters.push(`lr.start_date <= $${leaveParams.length}`);
  }
  const outOfficeParams = [...scope.params];
  const outOfficeFilters = [scope.whereSql];
  if (fromDate) {
    outOfficeParams.push(fromDate);
    outOfficeFilters.push(`oo.request_date >= $${outOfficeParams.length}`);
  }
  if (toDate) {
    outOfficeParams.push(toDate);
    outOfficeFilters.push(`oo.request_date <= $${outOfficeParams.length}`);
  }
  const leaveSql = `
    SELECT
      d.id AS department_id,
      COALESCE(d.name, 'Chưa phân bổ') AS department_name,
      COUNT(*)::int AS total,
      COUNT(DISTINCT lr.employee_id) FILTER (
        WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')
      )::int AS employees,
      COUNT(*) FILTER (WHERE lr.status IN ('PENDING', 'APPROVED_BY_LEAD'))::int AS pending,
      COUNT(*) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED'))::int AS approved,
      COUNT(*) FILTER (WHERE lr.status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE lr.status = 'CANCELLED')::int AS cancelled,
      COALESCE(SUM(lr.duration_days) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')), 0)::float AS days
    FROM leave_requests lr
    JOIN users u ON u.id = lr.employee_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE ${leaveFilters.join(" AND ")}
    GROUP BY d.id, d.name
  `;
  const outOfficeSql = `
    SELECT
      d.id AS department_id,
      COALESCE(d.name, 'Chưa phân bổ') AS department_name,
      COUNT(*)::int AS total,
      COUNT(DISTINCT oo.employee_id) FILTER (
        WHERE oo.status IN ('APPROVED', 'COMPLETED')
      )::int AS employees,
      COUNT(*) FILTER (WHERE oo.status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE oo.status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE oo.status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE oo.status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE oo.status = 'CANCELLED')::int AS cancelled,
      COALESCE(SUM(oo.estimated_hours) FILTER (WHERE oo.status IN ('APPROVED', 'COMPLETED')), 0)::float AS hours
    FROM out_office_requests oo
    JOIN users u ON u.id = oo.employee_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE ${outOfficeFilters.join(" AND ")}
    GROUP BY d.id, d.name
  `;

  const [leaveRes, outOfficeRes] = await Promise.all([
    query(leaveSql, leaveParams),
    query(outOfficeSql, outOfficeParams),
  ]);
  const byDepartment = new Map<string, ScopeReportDepartment>();

  for (const row of leaveRes.rows) {
    const key = row.department_id ?? "unassigned";
    byDepartment.set(key, {
      departmentId: row.department_id,
      departmentName: row.department_name,
      leaveTotal: row.total,
      leaveEmployees: row.employees,
      leavePending: row.pending,
      leaveApproved: row.approved,
      leaveRejected: row.rejected,
      leaveCancelled: row.cancelled,
      leaveDays: row.days,
      outOfficeTotal: 0,
      outOfficeEmployees: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeCancelled: 0,
      outOfficeHours: 0,
    });
  }

  for (const row of outOfficeRes.rows) {
    const key = row.department_id ?? "unassigned";
    const department = byDepartment.get(key) ?? {
      departmentId: row.department_id,
      departmentName: row.department_name,
      leaveTotal: 0,
      leaveEmployees: 0,
      leavePending: 0,
      leaveApproved: 0,
      leaveRejected: 0,
      leaveCancelled: 0,
      leaveDays: 0,
      outOfficeTotal: 0,
      outOfficeEmployees: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeCancelled: 0,
      outOfficeHours: 0,
    };
    department.outOfficeTotal = row.total;
    department.outOfficeEmployees = row.employees;
    department.outOfficePending = row.pending;
    department.outOfficeApproved = row.approved;
    department.outOfficeCompleted = row.completed;
    department.outOfficeRejected = row.rejected;
    department.outOfficeCancelled = row.cancelled;
    department.outOfficeHours = row.hours;
    byDepartment.set(key, department);
  }

  const departments: ScopeReportDepartment[] = [];
  byDepartment.forEach((department) => departments.push(department));
  departments.sort((a, b) =>
    a.departmentName.localeCompare(b.departmentName, "vi"),
  );
  const totals = departments.reduce<ScopeReport["totals"]>(
    (sum, department) => {
      for (const key of Object.keys(sum) as (keyof ScopeReport["totals"])[]) {
        sum[key] += department[key];
      }
      return sum;
    },
    {
      leaveTotal: 0,
      leaveEmployees: 0,
      leavePending: 0,
      leaveApproved: 0,
      leaveRejected: 0,
      leaveCancelled: 0,
      leaveDays: 0,
      outOfficeTotal: 0,
      outOfficeEmployees: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeCancelled: 0,
      outOfficeHours: 0,
    },
  );

  return { departments, totals };
}

export type AbsenceTrendGrouping = "day" | "month" | "year";

export interface AbsenceTrendItem {
  period: string;
  fromDate: string;
  toDate: string;
  leaveEmployees: number;
  leaveRequests: number;
  outOfficeEmployees: number;
  outOfficeRequests: number;
}

export async function getAbsenceTrend(
  user: SafeUser,
  fromDate: string,
  toDate: string,
  grouping: AbsenceTrendGrouping,
): Promise<AbsenceTrendItem[]> {
  const scope = buildReportDataScope(user, "u");
  const params = [...scope.params, fromDate, toDate];
  const fromParam = `$${scope.params.length + 1}`;
  const toParam = `$${scope.params.length + 2}`;
  const dateSpanDays =
    (Date.parse(`${toDate}T00:00:00Z`) -
      Date.parse(`${fromDate}T00:00:00Z`)) /
    (24 * 60 * 60 * 1000);

  const bucketSql = {
    day: `
      SELECT periods.period_start::date AS bucket_start,
             GREATEST(periods.period_start::date, ${fromParam}::date) AS period_start,
             LEAST(periods.period_start::date, ${toParam}::date) AS period_end
        FROM generate_series(
          ${fromParam}::date::timestamp,
          ${toParam}::date::timestamp,
          INTERVAL '1 day'
        ) AS periods(period_start)`,
    month: `
      SELECT periods.period_start::date AS bucket_start,
             GREATEST(periods.period_start::date, ${fromParam}::date) AS period_start,
             LEAST(
               (periods.period_start + INTERVAL '1 month' - INTERVAL '1 day')::date,
               ${toParam}::date
             ) AS period_end
        FROM generate_series(
          DATE_TRUNC('month', ${fromParam}::date),
          DATE_TRUNC('month', ${toParam}::date),
          INTERVAL '1 month'
        ) AS periods(period_start)`,
    year: `
      SELECT periods.period_start::date AS bucket_start,
             GREATEST(periods.period_start::date, ${fromParam}::date) AS period_start,
             LEAST(
               (periods.period_start + INTERVAL '1 year' - INTERVAL '1 day')::date,
               ${toParam}::date
             ) AS period_end
        FROM generate_series(
          DATE_TRUNC('year', ${fromParam}::date),
          DATE_TRUNC('year', ${toParam}::date),
          INTERVAL '1 year'
        ) AS periods(period_start)`,
  }[grouping];
  const periodFormat = {
    day: dateSpanDays > 365 ? "DD/MM/YY" : "DD/MM",
    month: "MM/YYYY",
    year: "YYYY",
  }[grouping];

  const result = await query<{
    period: string;
    from_date: string;
    to_date: string;
    leave_employees: number;
    leave_requests: number;
    out_office_employees: number;
    out_office_requests: number;
  }>(
    `WITH buckets AS (${bucketSql}),
     leave_rows AS (
       SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date
         FROM leave_requests lr
         JOIN users u ON u.id = lr.employee_id
        WHERE ${scope.whereSql}
          AND lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')
          AND lr.end_date >= ${fromParam}::date
          AND lr.start_date <= ${toParam}::date
     ),
     out_office_rows AS (
       SELECT oo.id, oo.employee_id, oo.request_date
         FROM out_office_requests oo
         JOIN users u ON u.id = oo.employee_id
        WHERE ${scope.whereSql}
          AND oo.status IN ('APPROVED', 'COMPLETED')
          AND oo.request_date BETWEEN ${fromParam}::date AND ${toParam}::date
     ),
     leave_stats AS (
       SELECT b.bucket_start,
              COUNT(DISTINCT lr.employee_id)::int AS employees,
              COUNT(DISTINCT lr.id)::int AS requests
         FROM buckets b
         LEFT JOIN leave_rows lr
           ON lr.start_date <= b.period_end
          AND lr.end_date >= b.period_start
        GROUP BY b.bucket_start
     ),
     out_office_stats AS (
       SELECT b.bucket_start,
              COUNT(DISTINCT oo.employee_id)::int AS employees,
              COUNT(DISTINCT oo.id)::int AS requests
         FROM buckets b
         LEFT JOIN out_office_rows oo
           ON oo.request_date BETWEEN b.period_start AND b.period_end
        GROUP BY b.bucket_start
     )
     SELECT TO_CHAR(b.bucket_start, '${periodFormat}') AS period,
            TO_CHAR(b.period_start, 'YYYY-MM-DD') AS from_date,
            TO_CHAR(b.period_end, 'YYYY-MM-DD') AS to_date,
            COALESCE(l.employees, 0)::int AS leave_employees,
            COALESCE(l.requests, 0)::int AS leave_requests,
            COALESCE(o.employees, 0)::int AS out_office_employees,
            COALESCE(o.requests, 0)::int AS out_office_requests
       FROM buckets b
       LEFT JOIN leave_stats l ON l.bucket_start = b.bucket_start
       LEFT JOIN out_office_stats o ON o.bucket_start = b.bucket_start
      ORDER BY b.bucket_start`,
    params,
  );
  return result.rows.map((row) => ({
    period: row.period,
    fromDate: row.from_date,
    toDate: row.to_date,
    leaveEmployees: Number(row.leave_employees),
    leaveRequests: Number(row.leave_requests),
    outOfficeEmployees: Number(row.out_office_employees),
    outOfficeRequests: Number(row.out_office_requests),
  }));
}

export interface HrAdvancedReport {
  topLeaveEmployees: Array<{
    employeeId: string;
    employeeName: string;
    departmentName: string;
    leaveDays: number;
    leaveRequests: number;
  }>;
  longLeaveCount: number;
  longLeaveRequests: Array<{
    id: string;
    employeeName: string;
    departmentName: string;
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  lateOutOfficeDetails: Array<{
    id: string;
    employeeName: string;
    departmentName: string;
    requestDate: string;
    scheduledEndTime: string;
    actualReturnAt: string;
    delayMinutes: number;
  }>;
  lateOutOfficeReturns: number;
  actualTracking: {
    completedCount: number;
    onTimeCount: number;
    lateCount: number;
  };
}

const emptyHrAdvancedReport: HrAdvancedReport = {
  topLeaveEmployees: [],
  longLeaveCount: 0,
  longLeaveRequests: [],
  lateOutOfficeDetails: [],
  lateOutOfficeReturns: 0,
  actualTracking: { completedCount: 0, onTimeCount: 0, lateCount: 0 },
};

/** Báo cáo chuyên sâu cho HR/Director/Accountant trong đúng phạm vi dữ liệu. */
export async function getHrAdvancedReport(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
): Promise<HrAdvancedReport> {
  if (
    !["ADMIN", "TEAM_LEAD", "MANAGER", "DIRECTOR", "ACCOUNTANT"].includes(
      user.role,
    )
  )
    return emptyHrAdvancedReport;

  const scope = buildReportDataScope(user, "u");
  const dateFilter = (column: string, params: any[], conditions: string[]) => {
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`${column} >= $${params.length}`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`${column} <= $${params.length}`);
    }
  };

  const topParams: any[] = [...scope.params];
  const topConditions = [scope.whereSql];
  dateFilter("lr.start_date", topParams, topConditions);
  const lateParams: any[] = [...scope.params];
  const lateConditions = [scope.whereSql, `oo.status = 'COMPLETED'`];
  dateFilter("oo.request_date", lateParams, lateConditions);
  const lateDetailParams: any[] = [...scope.params];
  const lateDetailConditions = [
    scope.whereSql,
    `oo.status = 'COMPLETED'`,
    `oo.actual_return_at IS NOT NULL`,
    `(oo.actual_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh') > (oo.request_date + oo.end_time)`,
  ];
  dateFilter("oo.request_date", lateDetailParams, lateDetailConditions);
  const longLeaveParams: any[] = [...scope.params];
  const longLeaveConditions = [
    scope.whereSql,
    `lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')`,
    `lr.duration_days > 2`,
  ];
  if (fromDate) {
    longLeaveParams.push(fromDate);
    longLeaveConditions.push(`lr.end_date >= $${longLeaveParams.length}`);
  }
  if (toDate) {
    longLeaveParams.push(toDate);
    longLeaveConditions.push(`lr.start_date <= $${longLeaveParams.length}`);
  }

  const [
    top,
    actualTracking,
    longLeaves,
    lateDetails,
  ] = await Promise.all([
    query(
      `SELECT u.id AS employee_id, u.full_name AS employee_name, COALESCE(d.name, 'Chưa phân bổ') AS department_name, COALESCE(SUM(lr.duration_days), 0)::float AS leave_days, COUNT(*)::int AS leave_requests FROM leave_requests lr JOIN users u ON u.id = lr.employee_id LEFT JOIN departments d ON d.id = u.department_id WHERE ${topConditions.join(" AND ")} AND lr.status IN ('WAITING_FOR_DOC','COMPLETED') GROUP BY u.id, u.full_name, d.name ORDER BY leave_days DESC LIMIT 10`,
      topParams,
    ),
    query<{ completed_count: number; on_time_count: number; late_count: number }>(
      `SELECT COUNT(*)::int AS completed_count,
              (COUNT(*) FILTER (WHERE (oo.actual_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh') <= (oo.request_date + oo.end_time)))::int AS on_time_count,
              (COUNT(*) FILTER (WHERE (oo.actual_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh') > (oo.request_date + oo.end_time)))::int AS late_count
         FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id
        WHERE ${lateConditions.join(" AND ")} AND oo.actual_return_at IS NOT NULL`,
      lateParams,
    ),
    query<{
      id: string;
      employee_name: string;
      department_name: string;
      start_date: string;
      end_date: string;
      duration_days: number;
      total_count: number;
    }>(
      `SELECT lr.id, u.full_name AS employee_name,
              COALESCE(d.name, 'Chưa phân bổ') AS department_name,
              TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
              lr.duration_days::float AS duration_days,
              COUNT(*) OVER()::int AS total_count
         FROM leave_requests lr
         JOIN users u ON u.id = lr.employee_id
         LEFT JOIN departments d ON d.id = u.department_id
        WHERE ${longLeaveConditions.join(" AND ")}
        ORDER BY lr.duration_days DESC, lr.start_date DESC
        LIMIT 10`,
      longLeaveParams,
    ),
    query<{
      id: string;
      employee_name: string;
      department_name: string;
      request_date: string;
      scheduled_end_time: string;
      actual_return_at: string;
      delay_minutes: number;
    }>(
      `SELECT oo.id, u.full_name AS employee_name,
              COALESCE(d.name, 'Chưa phân bổ') AS department_name,
              TO_CHAR(oo.request_date, 'YYYY-MM-DD') AS request_date,
              TO_CHAR(oo.end_time, 'HH24:MI') AS scheduled_end_time,
              TO_CHAR(oo.actual_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') AS actual_return_at,
              ROUND(EXTRACT(EPOCH FROM ((oo.actual_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh') - (oo.request_date + oo.end_time))) / 60)::int AS delay_minutes
         FROM out_office_requests oo
         JOIN users u ON u.id = oo.employee_id
         LEFT JOIN departments d ON d.id = u.department_id
        WHERE ${lateDetailConditions.join(" AND ")}
        ORDER BY oo.request_date DESC, oo.actual_return_at DESC
        LIMIT 10`,
      lateDetailParams,
    ),
  ]);

  return {
    topLeaveEmployees: top.rows.map((row: any) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      departmentName: row.department_name,
      leaveDays: Number(row.leave_days),
      leaveRequests: Number(row.leave_requests),
    })),
    longLeaveCount: Number(longLeaves.rows[0]?.total_count || 0),
    longLeaveRequests: longLeaves.rows.map((row) => ({
      id: row.id,
      employeeName: row.employee_name,
      departmentName: row.department_name,
      startDate: row.start_date,
      endDate: row.end_date,
      durationDays: Number(row.duration_days),
    })),
    lateOutOfficeDetails: lateDetails.rows.map((row) => ({
      id: row.id,
      employeeName: row.employee_name,
      departmentName: row.department_name,
      requestDate: row.request_date,
      scheduledEndTime: row.scheduled_end_time,
      actualReturnAt: row.actual_return_at,
      delayMinutes: Number(row.delay_minutes),
    })),
    lateOutOfficeReturns: Number(actualTracking.rows[0]?.late_count || 0),
    actualTracking: {
      completedCount: Number(actualTracking.rows[0]?.completed_count || 0),
      onTimeCount: Number(actualTracking.rows[0]?.on_time_count || 0),
      lateCount: Number(actualTracking.rows[0]?.late_count || 0),
    },
  };
}

/**
 * Lấy danh sách hoạt động gần đây của người dùng
 */
export async function getRecentActivities(
  user: SafeUser,
): Promise<RecentActivityItem[]> {
  const leaveQuery = `
    SELECT 
      id,
      'LEAVE' AS type,
      CONCAT('Nghỉ phép: ', duration_days, ' ngày làm việc') AS title,
      COALESCE(reason, 'Nghỉ phép') AS subtitle,
      CONCAT(TO_CHAR(start_date, 'DD/MM/YYYY'), ' → ', TO_CHAR(end_date, 'DD/MM/YYYY')) AS date_info,
      status,
      created_at
    FROM leave_requests
    WHERE employee_id = $1
    ORDER BY created_at DESC
    LIMIT 4
  `;

  const outOfficeQuery = `
    SELECT 
      id,
      'OUT_OFFICE' AS type,
      CONCAT('Ra ngoài (', CASE WHEN reason_type = 'WORK' THEN 'Việc công' ELSE 'Việc riêng' END, '): ', estimated_hours, 'h') AS title,
      COALESCE(reason, 'Ra ngoài') AS subtitle,
      CONCAT(TO_CHAR(request_date, 'DD/MM/YYYY'), ' (', TO_CHAR(start_time, 'HH24:MI'), ' - ', TO_CHAR(end_time, 'HH24:MI'), ')') AS date_info,
      status,
      created_at
    FROM out_office_requests
    WHERE employee_id = $1
    ORDER BY created_at DESC
    LIMIT 4
  `;

  const [leaveRes, outOfficeRes] = await Promise.all([
    query(leaveQuery, [user.id]),
    query(outOfficeQuery, [user.id]),
  ]);

  const combined: RecentActivityItem[] = [
    ...leaveRes.rows.map((r) => ({
      id: r.id,
      type: "LEAVE" as const,
      title: r.title,
      subtitle: r.subtitle,
      dateInfo: r.date_info,
      status: r.status,
      createdAt: r.created_at,
      link: `/leave/${r.id}`,
    })),
    ...outOfficeRes.rows.map((r) => ({
      id: r.id,
      type: "OUT_OFFICE" as const,
      title: r.title,
      subtitle: r.subtitle,
      dateInfo: r.date_info,
      status: r.status,
      createdAt: r.created_at,
      link: `/out-office/${r.id}`,
    })),
  ];

  // Sắp xếp giảm dần theo thời gian tạo
  combined.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return combined.slice(0, 5);
}

export interface ScopeActivityItem {
  id: string;
  type: "LEAVE" | "OUT_OFFICE";
  employeeName: string;
  departmentName: string | null;
  dateLabel: string;
  detailLabel: string;
  status: string;
  link: string;
  sortDate: Date;
}

/**
 * Lấy danh sách hoạt động (nghỉ phép + ra ngoài) trong phạm vi quyền hạn,
 * gộp và sắp xếp theo ngày diễn ra. Dùng cho bảng theo dõi trên Dashboard.
 */
export async function getScopeActivityFeed(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
  limit = 15,
): Promise<ScopeActivityItem[]> {
  const scope = buildUserDataScope(user, "u");
  const leaveParams: any[] = [...scope.params];
  const leaveConditions: string[] = [scope.whereSql];
  if (fromDate) {
    leaveParams.push(fromDate);
    leaveConditions.push("lr.start_date >= $" + leaveParams.length);
  }
  if (toDate) {
    leaveParams.push(toDate);
    leaveConditions.push("lr.start_date <= $" + leaveParams.length);
  }

  const leaveSql = `
    SELECT
      lr.id,
      u.full_name AS employee_name,
      d.name AS department_name,
      TO_CHAR(lr.start_date, 'DD/MM/YYYY') AS date_label,
      CONCAT(lr.duration_days, ' ngày (', TO_CHAR(lr.start_date, 'DD/MM'), ' → ', TO_CHAR(lr.end_date, 'DD/MM'), ')') AS detail_label,
      lr.status,
      lr.start_date AS sort_date
    FROM leave_requests lr
    JOIN users u ON lr.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE ${leaveConditions.join(" AND ")}
    ORDER BY lr.start_date DESC
    LIMIT ${limit}
  `;

  const outOfficeParams: any[] = [...scope.params];
  const outOfficeConditions: string[] = [scope.whereSql];
  if (fromDate) {
    outOfficeParams.push(fromDate);
    outOfficeConditions.push("oo.request_date >= $" + outOfficeParams.length);
  }
  if (toDate) {
    outOfficeParams.push(toDate);
    outOfficeConditions.push("oo.request_date <= $" + outOfficeParams.length);
  }

  const outOfficeSql = `
    SELECT
      oo.id,
      u.full_name AS employee_name,
      d.name AS department_name,
      TO_CHAR(oo.request_date, 'DD/MM/YYYY') AS date_label,
      CONCAT(oo.start_time, ' - ', oo.end_time, ' (', oo.estimated_hours, 'h)') AS detail_label,
      oo.status,
      oo.request_date AS sort_date
    FROM out_office_requests oo
    JOIN users u ON oo.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE ${outOfficeConditions.join(" AND ")}
    ORDER BY oo.request_date DESC
    LIMIT ${limit}
  `;

  const [leaveRes, outOfficeRes] = await Promise.all([
    query(leaveSql, leaveParams),
    query(outOfficeSql, outOfficeParams),
  ]);

  const items: ScopeActivityItem[] = [
    ...leaveRes.rows.map((r: any) => ({
      id: r.id,
      type: "LEAVE" as const,
      employeeName: r.employee_name,
      departmentName: r.department_name,
      dateLabel: r.date_label,
      detailLabel: r.detail_label,
      status: r.status,
      link: `/leave/${r.id}`,
      sortDate: r.sort_date,
    })),
    ...outOfficeRes.rows.map((r: any) => ({
      id: r.id,
      type: "OUT_OFFICE" as const,
      employeeName: r.employee_name,
      departmentName: r.department_name,
      dateLabel: r.date_label,
      detailLabel: r.detail_label,
      status: r.status,
      link: `/out-office/${r.id}`,
      sortDate: r.sort_date,
    })),
  ];

  items.sort(
    (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
  );
  return items.slice(0, limit);
}


export interface ApprovalMetricDetail {
  id: string;
  request_type: "LEAVE" | "OUT_OFFICE";
  request_id: string;
  employee_name: string;
  department_name: string | null;
  request_date: string;
  action: string;
  comment: string | null;
  action_at: Date;
  elapsed_hours: number;
}

export async function getApprovalMetricDetails(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
  pagination: { limit: number; offset: number } = { limit: 25, offset: 0 },
): Promise<ApprovalMetricDetail[]> {
  const scope = buildReportDataScope(user, "u");
  const params: unknown[] = [...scope.params];
  const conditions = [
    scope.whereSql,
    `ah.action IN ('APPROVED_LEAD', 'APPROVED_DIRECTOR', 'REJECTED')`,
  ];
  if (fromDate) {
    params.push(fromDate);
    conditions.push(`COALESCE(lr.start_date, oo.request_date) >= $${params.length}`);
  }
  if (toDate) {
    params.push(toDate);
    conditions.push(`COALESCE(lr.start_date, oo.request_date) <= $${params.length}`);
  }
  params.push(Math.min(100, Math.max(1, pagination.limit)) + 1);
  const limitParam = params.length;
  params.push(Math.max(0, pagination.offset));
  const offsetParam = params.length;

  const result = await query<ApprovalMetricDetail>(
    `SELECT ah.id, ah.request_type, ah.request_id, u.full_name AS employee_name,
            d.name AS department_name,
            TO_CHAR(COALESCE(lr.start_date, oo.request_date), 'YYYY-MM-DD') AS request_date,
            ah.action, ah.comment, ah.created_at AS action_at,
            EXTRACT(EPOCH FROM (ah.created_at - COALESCE(lr.created_at, oo.created_at))) / 3600 AS elapsed_hours
       FROM approval_history ah
       LEFT JOIN leave_requests lr ON ah.request_type = 'LEAVE' AND lr.id = ah.request_id
       LEFT JOIN out_office_requests oo ON ah.request_type = 'OUT_OFFICE' AND oo.id = ah.request_id
       JOIN users u ON u.id = COALESCE(lr.employee_id, oo.employee_id)
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ah.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params as any[],
  );
  return result.rows;
}
