import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/permissions';
import { removePushSubscription, savePushSubscription } from '@/lib/notifications/push';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập lại.' }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Thông tin thiết bị không hợp lệ.' }, { status: 400 });

  await savePushSubscription(user.id, parsed.data);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập lại.' }, { status: 401 });

  const body = z.object({ endpoint: z.string().url().max(2048) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Thiếu thông tin thiết bị.' }, { status: 400 });

  await removePushSubscription(user.id, body.data.endpoint);
  return NextResponse.json({ success: true });
}
