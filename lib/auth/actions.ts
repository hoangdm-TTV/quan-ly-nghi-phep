"use server";

import { z } from "zod";
import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/db/queries/users";
import { query } from "@/lib/db/pool";
import { verifyPassword } from "./password";
import {
  createSession,
  setSessionCookie,
  deleteSession,
  clearSessionCookie,
  getSessionIdFromCookie,
} from "./session";

const loginSchema = z.object({
  email: z
    .string()
    .email("Địa chỉ email không hợp lệ")
    .min(1, "Vui lòng nhập email"),
  password: z
    .string()
    .min(6, "Mật khẩu phải từ 6 ký tự trở lên")
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Mật khẩu không hợp lệ",
    ),
});
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MINUTES = 15;

function loginRateKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function reserveLoginAttempt(key: string): Promise<number> {
  // Keep abandoned email hashes from accumulating indefinitely.
  await query(
    `DELETE FROM login_rate_limits
      WHERE rate_key IN (
        SELECT rate_key FROM login_rate_limits
         WHERE window_started_at < NOW() - INTERVAL '1 day'
         ORDER BY window_started_at
         LIMIT 100
      )`,
  );
  const result = await query<{ attempt_count: number }>(
    `INSERT INTO login_rate_limits (rate_key, window_started_at, failed_attempts)
     VALUES ($1, NOW(), 1)
     ON CONFLICT (rate_key) DO UPDATE SET
       failed_attempts = CASE
         WHEN login_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 minute') THEN 1
         ELSE login_rate_limits.failed_attempts + 1
       END,
       window_started_at = CASE
         WHEN login_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 minute') THEN NOW()
         ELSE login_rate_limits.window_started_at
       END
     RETURNING failed_attempts::int AS attempt_count`,
    [key, LOGIN_WINDOW_MINUTES],
  );
  return result.rows[0]?.attempt_count ?? MAX_LOGIN_ATTEMPTS + 1;
}

export type ActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Server Action xử lý đăng nhập an toàn
 */
export async function loginAction(
  prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  const validated = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!validated.success) {
    return {
      error:
        validated.error.errors[0]?.message || "Dữ liệu nhập vào không hợp lệ",
    };
  }

  const { email, password } = validated.data;
  const rateKey = loginRateKey(email);

  try {
    const attemptCount = await reserveLoginAttempt(rateKey);
    if (attemptCount > MAX_LOGIN_ATTEMPTS) {
      return {
        error:
          "Email hoặc mật khẩu không chính xác. Vui lòng thử lại sau 15 phút.",
      };
    }
    // 1. Tìm người dùng theo email
    const user = await getUserByEmail(email);

    // Không tìm thấy user hoặc chưa được thiết lập mật khẩu
    if (!user || !user.password_hash) {
      return { error: "Email hoặc mật khẩu không chính xác" };
    }

    // 2. Kiểm tra tài khoản có bị vô hiệu hóa không
    if (!user.is_active || user.employment_status !== "ACTIVE") {
      return {
        error:
          user.employment_status === "TERMINATED"
            ? "Tài khoản đã được đánh dấu nghỉ việc."
            : "Tài khoản đang bị tạm khóa.",
      };
    }

    // 3. Xác minh mật khẩu băm
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return { error: "Email hoặc mật khẩu không chính xác" };
    }

    await query("DELETE FROM login_rate_limits WHERE rate_key = $1", [rateKey]);

    // 4. Tạo session an toàn phía server
    const { sessionId, expiresAt } = await createSession(user.id);

    // 5. Thiết lập Cookie HttpOnly an toàn
    setSessionCookie(sessionId, expiresAt);
  } catch (err: any) {
    console.error("[Login Action Error]", err);
    return {
      error:
        "Hệ thống đang bận hoặc có lỗi kết nối database. Vui lòng thử lại sau.",
    };
  }

  // 6. Chuyển hướng tới trang nội bộ sau khi đăng nhập thành công
  redirect("/");
}

/**
 * Server Action xử lý đăng xuất an toàn
 */
export async function logoutAction(): Promise<void> {
  const sessionId = getSessionIdFromCookie();
  if (sessionId) {
    try {
      await deleteSession(sessionId);
    } catch (err) {
      console.error("[Logout Action Error]", err);
    }
  }

  clearSessionCookie();
  redirect("/login");
}
