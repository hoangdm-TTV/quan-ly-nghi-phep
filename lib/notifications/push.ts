import 'server-only';
import { createECDH } from 'crypto';
import webpush from 'web-push';
import { query } from '@/lib/db/pool';

type PushPayload = { title: string; body: string; url: string };
export type PushDispatchResult = {
  sent: number;
  subscriptions: number;
  configured: boolean;
  failureStatus?: number;
  failureCode?: string;
};

function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  const decodeKey = (key: string) => Buffer.from(key.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const curve = createECDH('prime256v1');
  try {
    curve.setPrivateKey(decodeKey(privateKey));
  } catch {
    throw new Error('VAPID_PRIVATE_KEY không hợp lệ.');
  }
  if (!curve.getPublicKey().equals(decodeKey(publicKey))) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY không cùng một cặp.');
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey,
  );
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export async function savePushSubscription(userId: string, subscription: webpush.PushSubscription): Promise<void> {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           subscription = EXCLUDED.subscription,
           updated_at = NOW()`,
    [userId, subscription.endpoint, JSON.stringify(subscription)],
  );
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint]);
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushDispatchResult> {
  if (!userIds.length) return { sent: 0, subscriptions: 0, configured: false };
  if (!configureWebPush()) return { sent: 0, subscriptions: 0, configured: false };

  const subscriptions = await query<{ id: string; subscription: webpush.PushSubscription }>(
    `SELECT id, subscription FROM push_subscriptions WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  const serialized = JSON.stringify(payload);
  let delivered = 0;
  let failureStatus: number | undefined;
  let failureCode: string | undefined;
  await Promise.all(subscriptions.rows.map(async ({ id, subscription }) => {
    try {
      await webpush.sendNotification(subscription, serialized, { TTL: 60 * 60 });
      delivered += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      const code = (error as { code?: string }).code;
      failureStatus ||= statusCode;
      failureCode ||= code;
      if (statusCode === 404 || statusCode === 410) {
        await query('DELETE FROM push_subscriptions WHERE id = $1', [id]).catch(() => undefined);
      } else {
        console.error('[Push Notification Error]', { statusCode, code });
      }
    }
  }));
  return {
    sent: delivered,
    subscriptions: subscriptions.rows.length,
    configured: true,
    failureStatus,
    failureCode,
  };
}

export async function notifyLeaveApprovers(requestId: string): Promise<void> {
  const requestResult = await query<{ employee_id: string; role: string; department_id: string | null; status: string }>(
    `SELECT lr.employee_id, u.role, u.department_id, lr.status
       FROM leave_requests lr JOIN users u ON u.id = lr.employee_id WHERE lr.id = $1`,
    [requestId],
  );
  const request = requestResult.rows[0];
  if (!request) return;

  const approvers = request.status === 'APPROVED_BY_LEAD'
    ? await query<{ id: string }>(
        `SELECT id FROM users WHERE role = 'DIRECTOR' AND is_active = TRUE AND id <> $1`,
        [request.employee_id],
      )
    : await query<{ id: string }>(
        `SELECT id FROM users
          WHERE is_active = TRUE AND id <> $1 AND (
            (role = 'DIRECTOR' AND (
              $2 = 'MANAGER' OR $3::uuid IS NULL OR NOT EXISTS (
                SELECT 1 FROM users manager
                 WHERE manager.role = 'MANAGER' AND manager.is_active = TRUE
                   AND manager.department_id = $3::uuid
              )
            )) OR
            (role = 'MANAGER' AND $3::uuid IS NOT NULL AND department_id = $3::uuid
              AND $2 IN ('STAFF', 'TEAM_LEAD', 'ACCOUNTANT'))
          )`,
        [request.employee_id, request.role, request.department_id],
      );
  const dispatch = await sendPushToUsers(approvers.rows.map(({ id }) => id), {
    title: request.status === 'APPROVED_BY_LEAD' ? 'Đơn nghỉ phép cần Giám đốc duyệt' : 'Có đơn nghỉ phép cần duyệt',
    body: request.status === 'APPROVED_BY_LEAD'
      ? 'Một đơn nghỉ phép đã qua cấp Trưởng phòng và đang chờ duyệt cấp cuối.'
      : 'Một nhân viên vừa gửi đơn nghỉ phép mới.',
    url: `/leave/${requestId}`,
  });
  console.info('[Leave Push Dispatch]', {
    requestId,
    recipients: approvers.rows.length,
    subscriptions: dispatch.subscriptions,
    sent: dispatch.sent,
    failureStatus: dispatch.failureStatus,
    failureCode: dispatch.failureCode,
  });
}

export async function notifyOutOfficeApprovers(requestId: string): Promise<void> {
  const requestResult = await query<{ employee_id: string; role: string; department_id: string | null; team_id: string | null }>(
    `SELECT oo.employee_id, u.role, u.department_id, u.team_id
       FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id WHERE oo.id = $1`,
    [requestId],
  );
  const request = requestResult.rows[0];
  if (!request) return;

  const roleRouting: Record<string, string> = {
    STAFF: `role = 'TEAM_LEAD' AND team_id = $3::uuid AND $3::uuid IS NOT NULL`,
    TEAM_LEAD: `role = 'MANAGER' AND department_id = $2::uuid AND $2::uuid IS NOT NULL`,
    ACCOUNTANT: `role = 'MANAGER' AND department_id = $2::uuid AND $2::uuid IS NOT NULL`,
    MANAGER: `role = 'DIRECTOR'`,
  };
  const routing = roleRouting[request.role];
  if (!routing) return;
  const approvers = await query<{ id: string }>(
    `SELECT id FROM users WHERE is_active = TRUE AND id <> $1 AND ${routing}`,
    [request.employee_id, request.department_id, request.team_id],
  );
  const dispatch = await sendPushToUsers(approvers.rows.map(({ id }) => id), {
    title: 'Có đơn ra ngoài cần duyệt',
    body: 'Có đơn xin ra ngoài mới cần bạn duyệt.',
    url: `/out-office/${requestId}`,
  });
  console.info('[Out Office Push Dispatch]', {
    requestId,
    recipients: approvers.rows.length,
    subscriptions: dispatch.subscriptions,
    sent: dispatch.sent,
    failureStatus: dispatch.failureStatus,
    failureCode: dispatch.failureCode,
  });
}
