import type { SafeUser } from "@/lib/types/user";

export const PRIMARY_ADMIN_EMAIL = "admin@trithucvietbn.com";

export function canManageHr(user: Pick<SafeUser, "role" | "email">): boolean {
  return user.role === "ADMIN" && user.email.trim() === PRIMARY_ADMIN_EMAIL;
}
