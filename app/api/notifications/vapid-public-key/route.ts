import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key)
    return NextResponse.json(
      { error: "Thông báo đẩy chưa được cấu hình." },
      { status: 503 },
    );
  return NextResponse.json({ publicKey: key });
}
