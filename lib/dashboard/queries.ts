import { query } from '@/lib/db/pool';
import { SafeUser } from '@/lib/types/user';
import { getPendingLeaveRequestsForApprover } from '@/lib/leave/queries';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';

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

/**
 * Lấy danh sách hoạt động đơn gần đây của người dùng
 */
export async function getRecentActivities(user: SafeUser): Promise<RecentActivityItem[]> {
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
