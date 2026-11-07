import { buildReportDataScope } from "@/lib/auth/data-scope";
import { query } from "@/lib/db/pool";
import type { SafeUser } from "@/lib/types/user";

export interface EmployeeDirectoryRow {
  id: string;
  employee_code: string | null;
  full_name: string;
  email: string;
  role: string;
  position: string | null;
  department_name: string | null;
  team_name: string | null;
  manager_name: string | null;
  employment_status: "ACTIVE" | "SUSPENDED" | "TERMINATED";
  is_active: boolean;
}

export interface EmployeeDirectoryDepartment {
  id: string;
  name: string;
}

export interface EmployeeDirectoryTeam extends EmployeeDirectoryDepartment {
  department_id: string | null;
}

export async function getEmployeeDirectory(
  user: SafeUser,
  filters: {
    q?: string;
    departmentId?: string;
    teamId?: string;
    unassignedOnly?: boolean;
    employmentStatus?: "ACTIVE" | "SUSPENDED" | "TERMINATED";
    missingEntitlementYear?: number;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const pageSize = Math.min(50, Math.max(1, Math.trunc(filters.pageSize ?? 25)));
  const page = Math.max(1, Math.min(100_000, Math.trunc(filters.page ?? 1)));
  const scope = buildReportDataScope(user, "u");
  const values: unknown[] = [...scope.params];
  const conditions = [scope.whereSql];
  const search = filters.q?.trim().slice(0, 100);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (filters.unassignedOnly) {
    conditions.push("(u.department_id IS NULL OR u.team_id IS NULL)");
  }
  if (filters.departmentId === "__UNASSIGNED__") {
    conditions.push("u.department_id IS NULL");
  } else if (filters.departmentId && uuidPattern.test(filters.departmentId)) {
    values.push(filters.departmentId);
    conditions.push(`u.department_id = $${values.length}::uuid`);
  }
  if (filters.teamId === "__UNASSIGNED__") {
    conditions.push("u.team_id IS NULL");
  } else if (filters.teamId && uuidPattern.test(filters.teamId)) {
    values.push(filters.teamId);
    conditions.push(`u.team_id = $${values.length}::uuid`);
  }
  if (["ACTIVE", "SUSPENDED", "TERMINATED"].includes(filters.employmentStatus || "")) {
    values.push(filters.employmentStatus);
    conditions.push(`u.employment_status = $${values.length}`);
  }
  if (
    Number.isInteger(filters.missingEntitlementYear) &&
    filters.missingEntitlementYear! >= 2000 &&
    filters.missingEntitlementYear! <= 2200
  ) {
    values.push(filters.missingEntitlementYear);
    conditions.push(
      `u.is_active = TRUE AND u.employment_status = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM leave_entitlements e WHERE e.user_id = u.id AND e.leave_year = $${values.length})`,
    );
  }

  if (search) {
    values.push(`%${search}%`);
    const parameter = `$${values.length}`;
    conditions.push(
      `(u.full_name ILIKE ${parameter} OR u.email ILIKE ${parameter} OR COALESCE(u.employee_code, '') ILIKE ${parameter} OR COALESCE(u.position, '') ILIKE ${parameter})`,
    );
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const optionValues = [...scope.params];
  const optionWhere = `WHERE ${scope.whereSql}`;
  const [countResult, usersResult, departmentsResult, teamsResult] = await Promise.all([
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM users u ${where}`,
      values,
    ),
    query<EmployeeDirectoryRow>(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.role, u.position,
              d.name AS department_name, t.name AS team_name, m.full_name AS manager_name,
              u.employment_status, u.is_active
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN teams t ON t.id = u.team_id
         LEFT JOIN users m ON m.id = u.manager_id
         ${where}
        ORDER BY CASE u.employment_status WHEN 'ACTIVE' THEN 0 WHEN 'SUSPENDED' THEN 1 ELSE 2 END,
                 u.full_name ASC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize + 1, (page - 1) * pageSize],
    ),
    query<EmployeeDirectoryDepartment>(
      `SELECT DISTINCT d.id, d.name FROM users u JOIN departments d ON d.id = u.department_id ${optionWhere} ORDER BY d.name`,
      optionValues,
    ),
    query<EmployeeDirectoryTeam>(
      `SELECT DISTINCT t.id, t.name, t.department_id FROM users u JOIN teams t ON t.id = u.team_id ${optionWhere} ORDER BY t.name`,
      optionValues,
    ),
  ]);

  return {
    employees: usersResult.rows.slice(0, pageSize),
    total: Number(countResult.rows[0]?.total || 0),
    page,
    pageSize,
    hasNext: usersResult.rows.length > pageSize,
    departments: departmentsResult.rows,
    teams: teamsResult.rows,
  };
}
