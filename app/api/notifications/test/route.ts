import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/permissions';
import { sendPushToUsers } from '@/lib/notifications/push';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập lại.' }, { status: 401 });

  try {
    const result = await sendPushToUsers([user.id], {
      title: 'Thử thông báo thành công',
      body: 'Thông báo đẩy đã hoạt động trên thiết bị này.',
      url: '/',
    });
    if (!result.sent) {
      if (!result.subscriptions) {
        return NextResponse.json(
          { error: 'Tài khoản này chưa có thiết bị đăng ký nhận push. Bấm bật thông báo lại trên thiết bị này.' },
          { status: 503 },
        );
      }
      if (result.failureStatus === 401 || result.failureStatus === 403) {
        return NextResponse.json(
          { error: `Push server từ chối xác thực (HTTP ${result.failureStatus}). Kiểm tra cặp VAPID trên server và đăng ký lại thiết bị.` },
          { status: 503 },
        );
      }
      if (result.failureStatus === 404 || result.failureStatus === 410) {
        return NextResponse.json(
          { error: 'Subscription của thiết bị đã hết hạn. Bấm bật thông báo lại để đăng ký mới.' },
          { status: 503 },
        );
      }
      if (result.failureCode) {
        return NextResponse.json(
          { error: `Không kết nối được dịch vụ push (${result.failureCode}). Kiểm tra kết nối mạng từ server.` },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: 'Push service chưa xác nhận gửi được thông báo. Kiểm tra log server để biết chi tiết.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const statusCode = (error as { statusCode?: number }).statusCode;
    console.error('[Push Test Error]', { statusCode, message });
    if (/subject/i.test(message)) {
      return NextResponse.json(
        { error: 'VAPID_SUBJECT không hợp lệ. Hãy dùng mailto:địa-chỉ-email hoặc URL https:, không dùng http://localhost.' },
        { status: 503 },
      );
    }
    if (/VAPID_PRIVATE_KEY|cùng một cặp/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (statusCode === 401 || statusCode === 403) {
      return NextResponse.json(
        { error: 'Push server từ chối xác thực. Kiểm tra cặp NEXT_PUBLIC_VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY có cùng cặp không.' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: statusCode ? `Push server trả về lỗi HTTP ${statusCode}. Hãy đăng ký lại thông báo trên thiết bị.` : 'Gửi thông báo thử thất bại. Kiểm tra cấu hình push và database.' },
      { status: 503 },
    );
  }
}
