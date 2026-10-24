import { query } from '@/lib/db/pool';

export interface Holiday {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function getAllHolidays(): Promise<Holiday[]> {
  const sql = `
    SELECT 
      id,
      name,
      TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
      is_active,
      created_at,
      updated_at
    FROM holidays
    ORDER BY start_date ASC
  `;
  const res = await query<Holiday>(sql);
  return res.rows;
}

export async function getActiveHolidaysInRange(
  startDate: string,
  endDate: string
): Promise<{ start_date: string; end_date: string }[]> {
  const sql = `
    SELECT 
      TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
    FROM holidays
    WHERE is_active = TRUE
      AND start_date <= $2
      AND end_date >= $1
    ORDER BY start_date ASC
  `;
  const res = await query<{ start_date: string; end_date: string }>(sql, [
    startDate,
    endDate,
  ]);
  return res.rows;
}

export async function getHolidayById(id: string): Promise<Holiday | null> {
  const sql = `
    SELECT 
      id,
      name,
      TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
      is_active,
      created_at,
      updated_at
    FROM holidays
    WHERE id = $1
    LIMIT 1
  `;
  const res = await query<Holiday>(sql, [id]);
  return res.rows[0] || null;
}
