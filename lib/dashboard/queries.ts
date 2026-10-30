import { query } from '@/lib/db/pool';
import { SafeUser } from '@/lib/types/user';
import { buildReportDataScope, buildUserDataScope } from '@/lib/auth/data-scope';
import { getPendingLeaveApprovalCount } from '@/lib/leave/queries';
import { getPendingOutOfficeApprovalCount } from '@/lib/out-office/queries';

export interface ScopeReportDepartment {
  departmentName: string;
  leaveTotal: number;
  leavePending: number;
  leaveApproved: number;
  leaveRejected: number;
  leaveCancelled: number;
  leaveDays: number;
  outOfficeTotal: number;
  outOfficePending: number;
  outOfficeApproved: number;
  outOfficeCompleted: number;
  outOfficeRejected: number;
  outOfficeCancelled: number;
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
  // Giám đốc không tạo đơn nên không có thống kê cá nhân.
  if (user.role === 'DIRECTOR') {
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
    getPendingLeaveApprovalCount(user),
    getPendingOutOfficeApprovalCount(user),
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

    pendingLeaveApprovals: pendingLeaves,
    pendingOutOfficeApprovals: pendingOutOffices,
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
      COALESCE(d.name, 'Chưa phân bổ') AS department_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lr.status IN ('PENDING', 'APPROVED_BY_LEAD'))::int AS pending,
      COUNT(*) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED'))::int AS approved,
      COUNT(*) FILTER (WHERE lr.status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE lr.status = 'CANCELLED')::int AS cancelled,
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
      COUNT(*) FILTER (WHERE oo.status = 'CANCELLED')::int AS cancelled,
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
      leaveCancelled: row.cancelled,
      leaveDays: row.days,
      outOfficeTotal: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeCancelled: 0,
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
      leaveCancelled: 0,
      leaveDays: 0,
      outOfficeTotal: 0,
      outOfficePending: 0,
      outOfficeApproved: 0,
      outOfficeCompleted: 0,
      outOfficeRejected: 0,
      outOfficeCancelled: 0,
      outOfficeHours: 0,
    };
    department.outOfficeTotal = row.total;
    department.outOfficePending = row.pending;
    department.outOfficeApproved = row.approved;
    department.outOfficeCompleted = row.completed;
    department.outOfficeRejected = row.rejected;
    department.outOfficeCancelled = row.cancelled;
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
    leaveCancelled: 0,
    leaveDays: 0,
    outOfficeTotal: 0,
    outOfficePending: 0,
    outOfficeApproved: 0,
    outOfficeCompleted: 0,
    outOfficeRejected: 0,
    outOfficeCancelled: 0,
    outOfficeHours: 0,
  });

  return { departments, totals };
}

export interface HrAdvancedReport {
  monthlyLeave: Array<{ month: string; requests: number; approvedDays: number; leaveRate: number }>;
  topLeaveEmployees: Array<{ employeeName: string; departmentName: string; leaveDays: number }>;
  averageApprovalHours: number;
  pendingByLevel: Array<{ level: string; count: number }>;
  employeesWithoutEntitlement: number;
  lateOutOfficeReturns: number;
}

const emptyHrAdvancedReport: HrAdvancedReport = {
  monthlyLeave: [],
  topLeaveEmployees: [],
  averageApprovalHours: 0,
  pendingByLevel: [],
  employeesWithoutEntitlement: 0,
  lateOutOfficeReturns: 0,
};

/** Báo cáo chuyên sâu cho HR/Director/Accountant trong đúng phạm vi dữ liệu. */
export async function getHrAdvancedReport(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
): Promise<HrAdvancedReport> {
  if (!['ADMIN', 'TEAM_LEAD', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT'].includes(user.role)) return emptyHrAdvancedReport;

  const scope = buildReportDataScope(user, 'u');
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

  const monthlyParams: any[] = [...scope.params];
  const monthlyConditions = [scope.whereSql];
  dateFilter('lr.start_date', monthlyParams, monthlyConditions);
  const topParams: any[] = [...scope.params];
  const topConditions = [scope.whereSql];
  dateFilter('lr.start_date', topParams, topConditions);
  const approvalParams: any[] = [...scope.params];
  const approvalConditions = [scope.whereSql];
  dateFilter('COALESCE(lr.start_date, oo.request_date)', approvalParams, approvalConditions);
  const pendingLeaveParams: any[] = [...scope.params];
  const pendingLeaveConditions = [scope.whereSql];
  dateFilter('lr.start_date', pendingLeaveParams, pendingLeaveConditions);
  const pendingOutParams: any[] = [...scope.params];
  const pendingOutConditions = [scope.whereSql];
  dateFilter('oo.request_date', pendingOutParams, pendingOutConditions);
  const entitlementParams: any[] = [...scope.params];
  const entitlementConditions = [scope.whereSql, `u.is_active = TRUE`, `u.employment_status = 'ACTIVE'`];
  const leaveYear = Number((fromDate || new Date().toISOString().slice(0, 10)).slice(0, 4));
  entitlementParams.push(leaveYear);
  const lateParams: any[] = [...scope.params];
  const lateConditions = [scope.whereSql, `oo.status = 'COMPLETED'`];
  dateFilter('oo.request_date', lateParams, lateConditions);

  const [monthly, top, approval, pendingLeave, pendingOut, noEntitlement, lateReturns] = await Promise.all([
    query(`SELECT TO_CHAR(DATE_TRUNC('month', lr.start_date), 'YYYY-MM') AS month, COUNT(*)::int AS requests, COALESCE(SUM(lr.duration_days) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC','COMPLETED')), 0)::float AS approved_days FROM leave_requests lr JOIN users u ON u.id = lr.employee_id WHERE ${monthlyConditions.join(' AND ')} GROUP BY 1 ORDER BY 1`, monthlyParams),
    query(`SELECT u.full_name AS employee_name, COALESCE(d.name, 'Chưa phân bổ') AS department_name, COALESCE(SUM(lr.duration_days), 0)::float AS leave_days FROM leave_requests lr JOIN users u ON u.id = lr.employee_id LEFT JOIN departments d ON d.id = u.department_id WHERE ${topConditions.join(' AND ')} AND lr.status IN ('WAITING_FOR_DOC','COMPLETED') GROUP BY u.id, u.full_name, d.name ORDER BY leave_days DESC LIMIT 10`, topParams),
    query<{ average_hours: number | null }>(`SELECT AVG(EXTRACT(EPOCH FROM (ah.created_at - COALESCE(lr.created_at, oo.created_at))) / 3600)::float AS average_hours FROM approval_history ah LEFT JOIN leave_requests lr ON ah.request_type = 'LEAVE' AND lr.id = ah.request_id LEFT JOIN out_office_requests oo ON ah.request_type = 'OUT_OFFICE' AND oo.id = ah.request_id JOIN users u ON u.id = COALESCE(lr.employee_id, oo.employee_id) WHERE ${approvalConditions.join(' AND ')} AND ah.action IN ('APPROVED_LEAD','APPROVED_DIRECTOR','REJECTED')`, approvalParams),
    query(`SELECT 'Nghỉ phép - Trưởng phòng' AS level, COUNT(*)::int AS count FROM leave_requests lr JOIN users u ON u.id = lr.employee_id WHERE ${pendingLeaveConditions.join(' AND ')} AND lr.status = 'PENDING' AND u.role IN ('STAFF','TEAM_LEAD','ACCOUNTANT') AND EXISTS (SELECT 1 FROM users m WHERE m.role = 'MANAGER' AND m.is_active = TRUE AND m.department_id = u.department_id) UNION ALL SELECT 'Nghỉ phép - Giám đốc' AS level, COUNT(*)::int AS count FROM leave_requests lr JOIN users u ON u.id = lr.employee_id WHERE ${pendingLeaveConditions.join(' AND ')} AND ((lr.status = 'APPROVED_BY_LEAD') OR (lr.status = 'PENDING' AND (u.role = 'MANAGER' OR NOT EXISTS (SELECT 1 FROM users m WHERE m.role = 'MANAGER' AND m.is_active = TRUE AND m.department_id = u.department_id))))`, pendingLeaveParams),
    query(`SELECT 'Ra ngoài - Trưởng nhóm' AS level, COUNT(*)::int AS count FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id WHERE ${pendingOutConditions.join(' AND ')} AND oo.status = 'PENDING' AND u.role = 'STAFF' AND EXISTS (SELECT 1 FROM users tl WHERE tl.role = 'TEAM_LEAD' AND tl.is_active = TRUE AND tl.team_id = u.team_id) UNION ALL SELECT 'Ra ngoài - Trưởng phòng' AS level, COUNT(*)::int AS count FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id WHERE ${pendingOutConditions.join(' AND ')} AND oo.status = 'PENDING' AND u.role IN ('TEAM_LEAD','ACCOUNTANT') UNION ALL SELECT 'Ra ngoài - Giám đốc' AS level, COUNT(*)::int AS count FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id WHERE ${pendingOutConditions.join(' AND ')} AND oo.status = 'PENDING' AND u.role = 'MANAGER'`, pendingOutParams),
    query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM users u WHERE ${entitlementConditions.join(' AND ')} AND NOT EXISTS (SELECT 1 FROM leave_entitlements e WHERE e.user_id = u.id AND e.leave_year = $${entitlementParams.length})`, entitlementParams),
    query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id WHERE ${lateConditions.join(' AND ')} AND ((oo.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = oo.request_date) AND (oo.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time > oo.end_time`, lateParams),
  ]);

  return {
    monthlyLeave: (() => {
      const totalApprovedDays = monthly.rows.reduce((sum: number, row: any) => sum + Number(row.approved_days), 0);
      return monthly.rows.map((row: any) => {
        const approvedDays = Number(row.approved_days);
        return { month: row.month, requests: Number(row.requests), approvedDays, leaveRate: totalApprovedDays ? (approvedDays / totalApprovedDays) * 100 : 0 };
      });
    })(),
    topLeaveEmployees: top.rows.map((row: any) => ({ employeeName: row.employee_name, departmentName: row.department_name, leaveDays: Number(row.leave_days) })),
    averageApprovalHours: Number(approval.rows[0]?.average_hours || 0),
    pendingByLevel: [...pendingLeave.rows, ...pendingOut.rows].map((row: any) => ({ level: row.level, count: Number(row.count) })),
    employeesWithoutEntitlement: Number(noEntitlement.rows[0]?.count || 0),
    lateOutOfficeReturns: Number(lateReturns.rows[0]?.count || 0),
  };
}

/**
 * Lấy danh sách hoạt động gần đây của người dùng
 */
export async function getRecentActivities(user: SafeUser): Promise<RecentActivityItem[]> {
  if (user.role === 'DIRECTOR') return [];

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

export interface ScopeActivityItem {
  id: string;
  type: 'LEAVE' | 'OUT_OFFICE';
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
  limit = 15
): Promise<ScopeActivityItem[]> {
  const scope = buildUserDataScope(user, 'u');
  const leaveParams: any[] = [...scope.params];
  const leaveConditions: string[] = [scope.whereSql];
  if (fromDate) {
    leaveParams.push(fromDate);
    leaveConditions.push('lr.start_date >= $' + leaveParams.length);
  }
  if (toDate) {
    leaveParams.push(toDate);
    leaveConditions.push('lr.start_date <= $' + leaveParams.length);
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
    WHERE ${leaveConditions.join(' AND ')}
    ORDER BY lr.start_date DESC
    LIMIT ${limit}
  `;

  const outOfficeParams: any[] = [...scope.params];
  const outOfficeConditions: string[] = [scope.whereSql];
  if (fromDate) {
    outOfficeParams.push(fromDate);
    outOfficeConditions.push('oo.request_date >= $' + outOfficeParams.length);
  }
  if (toDate) {
    outOfficeParams.push(toDate);
    outOfficeConditions.push('oo.request_date <= $' + outOfficeParams.length);
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
    WHERE ${outOfficeConditions.join(' AND ')}
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
      type: 'LEAVE' as const,
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
      type: 'OUT_OFFICE' as const,
      employeeName: r.employee_name,
      departmentName: r.department_name,
      dateLabel: r.date_label,
      detailLabel: r.detail_label,
      status: r.status,
      link: `/out-office/${r.id}`,
      sortDate: r.sort_date,
    })),
  ];

  items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
  return items.slice(0, limit);
}
