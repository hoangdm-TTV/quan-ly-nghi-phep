import { query } from '@/lib/db/pool';
import { SafeUser } from '@/lib/types/user';
import { buildReportDataScope } from '@/lib/auth/data-scope';
import { getPendingLeaveRequestsForApprover } from '@/lib/leave/queries';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';

export interface ScopeReportDepartment {
  departmentName: string;
  leaveTotal: number;
  leavePending: number;
  leaveApproved: number;
  leaveRejected: number;
  leaveDays: number;
  outOfficeTotal: number;
  outOfficePending: number;
  outOfficeApproved: number;
  outOfficeCompleted: number;
  outOfficeRejected: number;
  outOfficeHours: number;
}

export interface ScopeReport {
  departments: ScopeReportDepartment[];
  totals: Omit<ScopeReportDepartment, 'departmentName'>;
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

  // Thống kê chờ duyệt (dành cho người có thẩm quyền)
  pendingLeaveApprovals: number;
  pendingOutOfficeApprovals: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'LEAVE' | 'OUT_OFFICE';
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
export async function getDashboardStats(user: SafeUser): Promise<DashboardStats> {
  if (user.role === 'ACCOUNTANT') {
    return {
      myLeaveTotal: 0, myLeavePending: 0, myLeaveApproved: 0, myLeaveRejected: 0,
      myOutOfficeTotal: 0, myOutOfficePending: 0, myOutOfficeActive: 0, myOutOfficeCompleted: 0,
      pendingLeaveApprovals: 0, pendingOutOfficeApprovals: 0,
    };
  }

  // 1. Thống kê đơn nghỉ phép cá nhân
  const leaveStatsQuery = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status IN ('PENDING', 'APPROVED_BY_LEAD') THEN 1 END)::int AS pending,
      COUNT(CASE WHEN status IN ('WAITING_FOR_DOC', 'COMPLETED') THEN 1 END)::int AS approved,
      COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int AS rejected
    FROM leave_requests
    WHERE employee_id = $1
  `;

  // 2. Thống kê đơn ra ngoài cá nhân
  const outOfficeStatsQuery = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending,
      COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int AS active,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed
    FROM out_office_requests
    WHERE employee_id = $1
  `;

  const [leaveRes, outOfficeRes, pendingLeaves, pendingOutOffices] = await Promise.all([
    query(leaveStatsQuery, [user.id]),
    query(outOfficeStatsQuery, [user.id]),
    getPendingLeaveRequestsForApprover(user),
    getPendingOutOfficeRequestsForApprover(user),
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

    pendingLeaveApprovals: pendingLeaves.length,
    pendingOutOfficeApprovals: pendingOutOffices.length,
  };
}

/** Báo cáo tổng hợp trong cùng phạm vi dữ liệu áp dụng cho danh sách đơn. */
export async function getScopeReport(
  user: SafeUser,
  fromDate?: string,
  toDate?: string
): Promise<ScopeReport> {
  const scope = buildReportDataScope(user, 'u');
  const leaveParams = [...scope.params];
  const leaveFilters = [scope.whereSql];
  if (fromDate) {
    leaveParams.push(fromDate);
    leaveFilters.push(`lr.start_date >= $${leaveParams.length}`);
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
      COALESCE(d.name, 'Chưa phân bổ') AS department_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lr.status IN ('PENDING', 'APPROVED_BY_LEAD'))::int AS pending,
      COUNT(*) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED'))::int AS approved,
      COUNT(*) FILTER (WHERE lr.status = 'REJECTED')::int AS rejected,
      COALESCE(SUM(lr.duration_days) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')), 0)::float AS days
    FROM leave_requests lr
    JOIN users u ON u.id = lr.employee_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE ${leaveFilters.join(' AND ')}
    GROUP BY d.id, d.name
  `;
  const outOfficeSql = `
    SELECT
      COALESCE(d.name, 'Chưa phân bổ') AS department_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE oo.status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE oo.status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE oo.status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE oo.status = 'REJECTED')::int AS rejected,
      COALESCE(SUM(oo.estimated_hours) FILTER (WHERE oo.status IN ('APPROVED', 'COMPLETED')), 0)::float AS hours
    FROM out_office_requests oo
    JOIN users u ON u.id = oo.employee_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE ${outOfficeFilters.join(' AND ')}
    GROUP BY d.id, d.name
  `;

  const [leaveRes, outOfficeRes] = await Promise.all([
    query(leaveSql, leaveParams),
    query(outOfficeSql, outOfficeParams),
  ]);
  const byDepartment = new Map<string, ScopeReportDepartment>();

  for (const row of leaveRes.rows) {
    byDepartment.set(row.department_name, {
      departmentName: row.department_name,
      leaveTotal: row.total,
      leavePending: row.pending,
      leaveApproved: row.approved,
      leaveRejected: row.rejected,
      leaveDays: row.days,
      outOfficeTotal: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeHours: 0,
    });
  }

  for (const row of outOfficeRes.rows) {
    const department = byDepartment.get(row.department_name) ?? {
      departmentName: row.department_name,
      leaveTotal: 0,
      leavePending: 0,
      leaveApproved: 0,
      leaveRejected: 0,
      leaveDays: 0,
      outOfficeTotal: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeHours: 0,
    };
    department.outOfficeTotal = row.total;
    department.outOfficePending = row.pending;
    department.outOfficeApproved = row.approved;
    department.outOfficeCompleted = row.completed;
    department.outOfficeRejected = row.rejected;
    department.outOfficeHours = row.hours;
    byDepartment.set(row.department_name, department);
  }

  const departments: ScopeReportDepartment[] = [];
  byDepartment.forEach((department) => departments.push(department));
  departments.sort((a, b) => a.departmentName.localeCompare(b.departmentName, 'vi'));
  const totals = departments.reduce<ScopeReport['totals']>((sum, department) => {
    for (const key of Object.keys(sum) as (keyof ScopeReport['totals'])[]) {
      sum[key] += department[key];
    }
    return sum;
  }, {
    leaveTotal: 0,
    leavePending: 0,
    leaveApproved: 0,
    leaveRejected: 0,
    leaveDays: 0,
    outOfficeTotal: 0,
    outOfficePending: 0,
    outOfficeApproved: 0,
    outOfficeCompleted: 0,
    outOfficeRejected: 0,
    outOfficeHours: 0,
  });

  return { departments, totals };
}

/**
 * Lấy danh sách hoạt động gần đây của người dùng
 */
export async function getRecentActivities(user: SafeUser): Promise<RecentActivityItem[]> {
  if (user.role === 'ACCOUNTANT') return [];

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
      type: 'LEAVE' as const,
      title: r.title,
      subtitle: r.subtitle,
      dateInfo: r.date_info,
      status: r.status,
      createdAt: r.created_at,
      link: `/leave/${r.id}`,
    })),
    ...outOfficeRes.rows.map((r) => ({
      id: r.id,
      type: 'OUT_OFFICE' as const,
      title: r.title,
      subtitle: r.subtitle,
      dateInfo: r.date_info,
      status: r.status,
      createdAt: r.created_at,
      link: `/out-office/${r.id}`,
    })),
  ];

  // Sắp xếp giảm dần theo thời gian tạo
  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return combined.slice(0, 5);
}
