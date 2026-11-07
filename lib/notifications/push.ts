import "server-only";
import { createECDH } from "crypto";
import webpush from "web-push";
import { query } from "@/lib/db/pool";
import { createInAppNotifications } from "@/lib/notifications/in-app";

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

  const decodeKey = (key: string) =>
    Buffer.from(key.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const curve = createECDH("prime256v1");
  try {
    curve.setPrivateKey(decodeKey(privateKey));
  } catch {
    throw new Error("VAPID_PRIVATE_KEY không hợp lệ.");
  }
  if (!curve.getPublicKey().equals(decodeKey(publicKey))) {
    throw new Error(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY không cùng một cặp.",
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey,
  );
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export async function savePushSubscription(
  userId: string,
  subscription: webpush.PushSubscription,
): Promise<void> {
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

export async function removePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await query(
    "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
    [userId, endpoint],
  );
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushDispatchResult> {
  if (!userIds.length) return { sent: 0, subscriptions: 0, configured: false };
  if (!configureWebPush())
    return { sent: 0, subscriptions: 0, configured: false };

  const subscriptions = await query<{
    id: string;
    subscription: webpush.PushSubscription;
  }>(
    `SELECT id, subscription FROM push_subscriptions WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  const serialized = JSON.stringify(payload);
  let delivered = 0;
  let failureStatus: number | undefined;
  let failureCode: string | undefined;
  await Promise.all(
    subscriptions.rows.map(async ({ id, subscription }) => {
      try {
        await webpush.sendNotification(subscription, serialized, {
          TTL: 60 * 60,
        });
        delivered += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const code = (error as { code?: string }).code;
        failureStatus ||= statusCode;
        failureCode ||= code;
        if (statusCode === 404 || statusCode === 410) {
          await query("DELETE FROM push_subscriptions WHERE id = $1", [
            id,
          ]).catch(() => undefined);
        } else {
          console.error("[Push Notification Error]", { statusCode, code });
        }
      }
    }),
  );
  return {
    sent: delivered,
    subscriptions: subscriptions.rows.length,
    configured: true,
    failureStatus,
    failureCode,
  };
}

export async function notifyLeaveApprovers(requestId: string): Promise<void> {
  const requestResult = await query<{
    employee_id: string;
    manager_id: string | null;
    status: string;
  }>(
    `SELECT lr.employee_id, u.manager_id, lr.status
       FROM leave_requests lr JOIN users u ON u.id = lr.employee_id WHERE lr.id = $1`,
    [requestId],
  );
  const request = requestResult.rows[0];
  if (!request) return;

  if (!request.manager_id || request.manager_id === request.employee_id) return;
  const approvers = await query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND employment_status = 'ACTIVE'`,
    [request.manager_id],
  );
  const recipientIds = approvers.rows.map(({ id }) => id);
  const notification = {
    title: "Có đơn nghỉ phép cần duyệt",
    body: "Một nhân viên vừa gửi đơn nghỉ phép mới.",
    url: `/leave/${requestId}`,
  };
  const [dispatch] = await Promise.all([
    sendPushToUsers(recipientIds, notification),
    createInAppNotifications(recipientIds, {
      ...notification,
      type: "LEAVE_APPROVAL",
    }).catch((error) => console.error("[In-App Notification Error]", error)),
  ]);
  console.info("[Leave Push Dispatch]", {
    requestId,
    recipients: approvers.rows.length,
    subscriptions: dispatch.subscriptions,
    sent: dispatch.sent,
    failureStatus: dispatch.failureStatus,
    failureCode: dispatch.failureCode,
  });
}

export async function notifyOutOfficeApprovers(
  requestId: string,
): Promise<void> {
  const requestResult = await query<{
    employee_id: string;
    manager_id: string | null;
  }>(
    `SELECT oo.employee_id, u.manager_id
       FROM out_office_requests oo JOIN users u ON u.id = oo.employee_id WHERE oo.id = $1`,
    [requestId],
  );
  const request = requestResult.rows[0];
  if (!request) return;

  if (!request.manager_id || request.manager_id === request.employee_id) return;
  const approvers = await query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND employment_status = 'ACTIVE'`,
    [request.manager_id],
  );
  if (!approvers.rows.length) {
    console.warn(
      "[Out Office Notification] Không tìm thấy người duyệt trực tiếp",
      { requestId, managerId: request.manager_id },
    );
  }
  const recipientIds = approvers.rows.map(({ id }) => id);
  const notification = {
    title: "Có đơn ra ngoài cần duyệt",
    body: "Có đơn xin ra ngoài mới cần bạn duyệt.",
    url: `/out-office/${requestId}`,
  };
  const [dispatch] = await Promise.all([
    sendPushToUsers(recipientIds, notification),
    createInAppNotifications(recipientIds, {
      ...notification,
      type: "OUT_OFFICE_APPROVAL",
    }).catch((error) => console.error("[In-App Notification Error]", error)),
  ]);
  console.info("[Out Office Push Dispatch]", {
    requestId,
    recipients: approvers.rows.length,
    subscriptions: dispatch.subscriptions,
    sent: dispatch.sent,
    failureStatus: dispatch.failureStatus,
    failureCode: dispatch.failureCode,
  });
}

export async function notifyLeaveRequester(
  requestId: string,
  status: "WAITING_FOR_DOC" | "APPROVED_BY_LEAD" | "REJECTED",
) {
  const result = await query<{ employee_id: string }>(
    "SELECT employee_id FROM leave_requests WHERE id = $1",
    [requestId],
  );
  const employeeId = result.rows[0]?.employee_id;
  if (!employeeId) return;
  const messages = {
    WAITING_FOR_DOC: [
      "Đơn nghỉ phép đã được duyệt",
      "Nộp giấy đã ký để hoàn tất đơn.",
    ],
    APPROVED_BY_LEAD: [
      "Đơn nghỉ phép đã qua cấp 1",
      "Đơn đang chờ Giám đốc duyệt cấp cuối.",
    ],
    REJECTED: [
      "Đơn nghỉ phép bị từ chối",
      "Mở chi tiết đơn để xem lý do từ chối.",
    ],
  } as const;
  const notification = {
    title: messages[status][0],
    body: messages[status][1],
    url: `/leave/${requestId}`,
  };
  await Promise.all([
    sendPushToUsers([employeeId], notification),
    createInAppNotifications([employeeId], {
      ...notification,
      type: "LEAVE_STATUS",
    }).catch((error) => console.error("[In-App Notification Error]", error)),
  ]);
}

export async function notifyOutOfficeRequester(
  requestId: string,
  status: "APPROVED" | "COMPLETED" | "REJECTED",
) {
  const result = await query<{ employee_id: string }>(
    "SELECT employee_id FROM out_office_requests WHERE id = $1",
    [requestId],
  );
  const employeeId = result.rows[0]?.employee_id;
  if (!employeeId) return;
  const messages = {
    APPROVED: ["Đơn ra ngoài đã được duyệt", "Đơn của bạn đã được duyệt."],
    COMPLETED: [
      "Đơn ra ngoài đã hoàn tất",
      "Người duyệt đã xác nhận bạn quay về.",
    ],
    REJECTED: [
      "Đơn ra ngoài bị từ chối",
      "Mở chi tiết đơn để xem lý do từ chối.",
    ],
  } as const;
  const notification = {
    title: messages[status][0],
    body: messages[status][1],
    url: `/out-office/${requestId}`,
  };
  await Promise.all([
    sendPushToUsers([employeeId], notification),
    createInAppNotifications([employeeId], {
      ...notification,
      type: "OUT_OFFICE_STATUS",
    }).catch((error) => console.error("[In-App Notification Error]", error)),
  ]);
}
