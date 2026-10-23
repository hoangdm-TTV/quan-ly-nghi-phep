export type UserRole = 'STAFF' | 'TEAM_LEAD' | 'MANAGER' | 'ACCOUNTANT' | 'DIRECTOR';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  team_id: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// User dành cho session và phía client/UI (loại bỏ trường nhạy cảm như password_hash)
export interface SafeUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  department_name?: string | null;
  team_id: string | null;
  team_name?: string | null;
  manager_id: string | null;
  is_active: boolean;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface SessionData {
  id: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
}
