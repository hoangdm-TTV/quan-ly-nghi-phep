import { query } from "@/lib/db/pool";
import { SafeUser } from "@/lib/types/user";
import { buildReportDataScope } from "@/lib/auth/data-scope";

export type AbsenceCalendarItem = {
  id: string;
  type: "LEAVE" | "OUT_OFFICE";
  employeeName: string;
  departmentName: string | null;
  teamName: string | null;
  startDate: string;
  endDate: string;
  dayPart: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number;
  status: string;
  reason: string | null;
};

export async function getAbsenceCalendar(
  user: SafeUser,
  fromDate?: string,
  toDate?: string,
): Promise<AbsenceCalendarItem[]> {
  const scope = buildReportDataScope(user, "u");
  const params = [...scope.params];
  let leaveDateFilter = "";
  let outOfficeDateFilter = "";
  if (fromDate) {
    params.push(fromDate);
    const fromParam = `$${params.length}`;
    leaveDateFilter += ` AND lr.end_date >= ${fromParam}::date`;
    outOfficeDateFilter += ` AND oo.request_date >= ${fromParam}::date`;
  }
  if (toDate) {
    params.push(toDate);
    const toParam = `$${params.length}`;
    leaveDateFilter += ` AND lr.start_date <= ${toParam}::date`;
    outOfficeDateFilter += ` AND oo.request_date <= ${toParam}::date`;
  }
  const sql = `
    SELECT * FROM (
      SELECT lr.id, 'LEAVE'::text AS type, u.full_name AS employee_name,
             d.name AS department_name, t.name AS team_name,
             lr.start_date::text AS start_date, lr.end_date::text AS end_date,
             COALESCE(lr.day_part, 'FULL_DAY') AS day_part,
             NULL::text AS start_time, NULL::text AS end_time,
             lr.duration_days::float AS duration, lr.status, lr.reason
        FROM leave_requests lr
        JOIN users u ON u.id = lr.employee_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN teams t ON t.id = u.team_id
       WHERE ${scope.whereSql}
         AND lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')
         ${leaveDateFilter}
      UNION ALL
      SELECT oo.id, 'OUT_OFFICE'::text, u.full_name, d.name, t.name,
             oo.request_date::text, oo.request_date::text, NULL,
             oo.start_time::text, oo.end_time::text,
             oo.estimated_hours::float, oo.status, oo.reason
        FROM out_office_requests oo
        JOIN users u ON u.id = oo.employee_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN teams t ON t.id = u.team_id
       WHERE ${scope.whereSql}
         AND oo.status IN ('APPROVED', 'COMPLETED')
         ${outOfficeDateFilter}
    ) calendar
    ORDER BY start_date, type, employee_name`;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    employeeName: row.employee_name,
    departmentName: row.department_name,
    teamName: row.team_name,
    startDate: row.start_date,
    endDate: row.end_date,
    dayPart: row.day_part,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: Number(row.duration || 0),
    status: row.status,
    reason: row.reason,
  }));
}
