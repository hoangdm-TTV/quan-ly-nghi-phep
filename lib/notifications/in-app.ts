import "server-only";
import { query } from "@/lib/db/pool";

export type InAppNotificationPayload = {
  type?: string;
  title: string;
  body: string;
  url?: string;
};

export async function createInAppNotifications(
  userIds: string[],
  payload: InAppNotificationPayload,
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueUserIds.length) return;
  await query(
    `INSERT INTO notifications (user_id, type, title, body, url)
     SELECT unnest($1::uuid[]), $2, $3, $4, $5`,
    [
      uniqueUserIds,
      payload.type || "SYSTEM",
      payload.title,
      payload.body,
      payload.url || null,
    ],
  );
}
