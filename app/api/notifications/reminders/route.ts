import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { pool } from '@/lib/db/pool';
import { sendPushToUsers } from '@/lib/notifications/push';

export const runtime = 'nodejs';

function localDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts;
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!secret || !token) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = localDate();
  const [leaveRows, outOfficeRows] = await Promise.all([
    pool.query<{ request_id: string; status: string; recipients: string[] }>(
      `SELECT lr.id AS request_id, lr.status, array_agg(DISTINCT recipient.id) AS recipients
         FROM leave_requests lr
         JOIN users applicant ON applicant.id = lr.employee_id
         JOIN users recipient ON recipient.is_active = TRUE AND recipient.id <> applicant.id
          AND (
            (lr.status = 'APPROVED_BY_LEAD' AND recipient.role = 'DIRECTOR')
            OR (lr.status = 'PENDING' AND (
              (applicant.role = 'MANAGER' AND recipient.role = 'DIRECTOR')
              OR (applicant.role IN ('STAFF','TEAM_LEAD','ACCOUNTANT') AND recipient.role = 'MANAGER' AND recipient.department_id = applicant.department_id AND applicant.department_id IS NOT NULL)
              OR (applicant.role IN ('STAFF','TEAM_LEAD','ACCOUNTANT') AND recipient.role = 'DIRECTOR' AND (
                applicant.department_id IS NULL OR NOT EXISTS (
                  SELECT 1 FROM users manager WHERE manager.role = 'MANAGER' AND manager.is_active = TRUE AND manager.department_id = applicant.department_id
                )
              ))
            ))
          )
        WHERE lr.status IN ('PENDING','APPROVED_BY_LEAD') AND lr.updated_at < NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (SELECT 1 FROM reminder_dispatches rd WHERE rd.request_type = 'LEAVE' AND rd.request_id = lr.id AND rd.reminder_date = $1::date)
        GROUP BY lr.id, lr.status ORDER BY MIN(lr.created_at) LIMIT 1000`, [date]),
    pool.query<{ request_id: string; recipients: string[] }>(
      `SELECT oo.id AS request_id, array_agg(DISTINCT recipient.id) AS recipients
         FROM out_office_requests oo
         JOIN users applicant ON applicant.id = oo.employee_id
         JOIN users recipient ON recipient.is_active = TRUE AND recipient.id <> applicant.id
          AND (
            (applicant.role = 'STAFF' AND recipient.role = 'TEAM_LEAD' AND recipient.team_id = applicant.team_id AND applicant.team_id IS NOT NULL)
            OR (applicant.role IN ('TEAM_LEAD','ACCOUNTANT') AND recipient.role = 'MANAGER' AND recipient.department_id = applicant.department_id AND applicant.department_id IS NOT NULL)
            OR (applicant.role = 'MANAGER' AND recipient.role = 'DIRECTOR')
          )
        WHERE oo.status = 'PENDING' AND oo.updated_at < NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (SELECT 1 FROM reminder_dispatches rd WHERE rd.request_type = 'OUT_OFFICE' AND rd.request_id = oo.id AND rd.reminder_date = $1::date)
        GROUP BY oo.id ORDER BY MIN(oo.created_at) LIMIT 1000`, [date]),
  ]);

  let dispatched = 0;
  for (const item of leaveRows.rows) {
    const reservation = await pool.query(
      `INSERT INTO reminder_dispatches (request_type, request_id, reminder_date) VALUES ('LEAVE', $1, $2::date)
       ON CONFLICT DO NOTHING RETURNING id`, [item.request_id, date]);
    if (!reservation.rowCount) continue;
    await sendPushToUsers(item.recipients, {
      title: 'Đơn nghỉ phép đang chờ xử lý',
      body: item.status === 'APPROVED_BY_LEAD' ? 'Đơn đã chờ Giám đốc duyệt hơn 24 giờ.' : 'Đơn nghỉ phép đang chờ duyệt hơn 24 giờ.',
      url: `/leave/${item.request_id}`,
    });
    dispatched += 1;
  }
  for (const item of outOfficeRows.rows) {
    const reservation = await pool.query(
      `INSERT INTO reminder_dispatches (request_type, request_id, reminder_date) VALUES ('OUT_OFFICE', $1, $2::date)
       ON CONFLICT DO NOTHING RETURNING id`, [item.request_id, date]);
    if (!reservation.rowCount) continue;
    await sendPushToUsers(item.recipients, {
      title: 'Đơn ra ngoài đang chờ xử lý',
      body: 'Đơn xin ra ngoài đang chờ duyệt hơn 24 giờ.',
      url: `/out-office/${item.request_id}`,
    });
    dispatched += 1;
  }
  return NextResponse.json({ success: true, date, remindersDispatched: dispatched });
}
