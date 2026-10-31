import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { query } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const result = await query<{ avatar_data: Buffer; avatar_mime_type: string }>(
    `SELECT avatar_data, avatar_mime_type
       FROM users
      WHERE id = $1 AND is_active = TRUE AND avatar_data IS NOT NULL
      LIMIT 1`,
    [user.id],
  );
  const avatar = result.rows[0];
  if (!avatar) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(avatar.avatar_data), {
    headers: {
      "Content-Type": avatar.avatar_mime_type,
      "Content-Length": String(avatar.avatar_data.length),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
