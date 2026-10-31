import { query } from "@/lib/db/pool";

export type OutOfficeRoutingAvailability = {
  hasTeamLead: boolean;
  hasManager: boolean;
};

export async function getOutOfficeRoutingAvailability(
  departmentId: string | null,
  teamId: string | null,
): Promise<OutOfficeRoutingAvailability> {
  const result = await query<{ has_team_lead: boolean; has_manager: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1 FROM users
          WHERE role = 'TEAM_LEAD'
            AND is_active = TRUE
            AND employment_status = 'ACTIVE'
            AND team_id = $1::uuid
       ) AS has_team_lead,
       EXISTS (
         SELECT 1 FROM users
          WHERE role = 'MANAGER'
            AND is_active = TRUE
            AND employment_status = 'ACTIVE'
            AND department_id = $2::uuid
       ) AS has_manager`,
    [teamId, departmentId],
  );
  return {
    hasTeamLead: Boolean(result.rows[0]?.has_team_lead),
    hasManager: Boolean(result.rows[0]?.has_manager),
  };
}
