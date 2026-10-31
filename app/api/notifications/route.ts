import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { query } from "@/lib/db/pool";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await query<{
    id: string;
    type: string;
    title: string;
    body: string;
    url: string | null;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id, type, title, body, url, read_at, created_at
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 30`,
    [user.id],
  );
  const unread = result.rows.filter((item) => !item.read_at).length;
  return NextResponse.json({ notifications: result.rows, unread });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.all === true) {
    await query(
      "UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1",
      [user.id],
    );
  } else if (typeof body?.id === "string") {
    await query(
      "UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2",
      [body.id, user.id],
    );
  } else {
    return NextResponse.json({ error: "Thiếu id thông báo." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
