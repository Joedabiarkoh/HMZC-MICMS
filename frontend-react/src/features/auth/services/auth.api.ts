import api from "../../../api/axios";
import { AdminCreateUserPayload, AuditLogEntry, LoginPayload, PasswordChangePayload, PasswordResetResult, PermissionUpdatePayload, RegisterPayload, User } from "../types/auth.types";

// Calls the backend routes added alongside this frontend module:
// backend-fastapi/app/api/routes/auth.py (register/login/me/users), the
// first backend module beyond the health check that's actually wired
// up end-to-end.

export async function registerUser(payload: RegisterPayload): Promise<User> {
  const response = await api.post("/auth/register", payload);
  return response.data;
}

/**
 * Login uses OAuth2's password-flow form encoding (username + password as
 * form fields, not JSON) because that's what FastAPI's OAuth2PasswordRequestForm
 * expects server-side — see login() in auth.py. "username" carries the email.
 */
export async function loginUser(payload: LoginPayload): Promise<{ access_token: string; token_type: string }> {
  const form = new URLSearchParams();
  form.append("username", payload.email);
  form.append("password", payload.password);
  const response = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await api.get("/auth/me");
  return response.data;
}

/** Admin-only — backend returns 403 for non-admins (see get_current_admin_user). */
export async function listUsers(): Promise<User[]> {
  const response = await api.get("/auth/users");
  return response.data;
}

/** Admin-only. Promotes/changes another account's role. */
export async function updateUserRole(userId: number, role: string): Promise<User> {
  const response = await api.patch(`/auth/users/${userId}/role`, null, { params: { new_role: role } });
  return response.data;
}

/** Admin-only. New accounts start inactive — this is how they get let in. */
export async function approveUser(userId: number): Promise<User> {
  const response = await api.post(`/auth/users/${userId}/approve`);
  return response.data;
}

/** Admin-only. Suspends access without deleting the account's history. */
export async function deactivateUser(userId: number): Promise<User> {
  const response = await api.post(`/auth/users/${userId}/deactivate`);
  return response.data;
}

/**
 * Admin-only. Permanently removes the account — different from
 * deactivateUser, which only suspends sign-in. The backend refuses this
 * (400) if the account has ever issued a certificate, quotation, or
 * invoice, since those records still need to point at a real user row;
 * deactivate is the right call for that case instead.
 */
export async function deleteUser(userId: number): Promise<void> {
  await api.delete(`/auth/users/${userId}`);
}

/**
 * Admin-only. There is no "recover the password" endpoint and there
 * never will be — passwords are one-way hashed. This generates a new
 * temporary one, returned exactly once in the response, for the admin
 * to relay to the person directly (phone, in person, chat).
 */
export async function resetUserPassword(userId: number): Promise<PasswordResetResult> {
  const response = await api.post(`/auth/users/${userId}/reset-password`);
  return response.data;
}

/**
 * Admin-only. The actual replacement for self-service sign-up — the
 * account is active immediately (admin creating it is the approval),
 * with a generated temporary password emailed to the person if SMTP is
 * configured server-side, and returned here either way so the admin can
 * relay it manually if email isn't set up yet.
 */
export async function createUser(payload: AdminCreateUserPayload): Promise<PasswordResetResult> {
  const response = await api.post("/auth/users", payload);
  return response.data;
}

/** Self-service. Also clears must_change_password after an admin-issued reset. */
export async function changePassword(payload: PasswordChangePayload): Promise<User> {
  const response = await api.post("/auth/change-password", payload);
  return response.data;
}

/** Admin-only. The read side of record_audit (backend-fastapi's core/audit.py). */
export async function listAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const response = await api.get<AuditLogEntry[]>("/auth/audit-log", { params: { limit } });
  return response.data;
}

/**
 * Admin-only. Sets a user's extra_permissions — additive on top of
 * whatever their role already grants by default, never a way to take
 * something away. This is how a "limited administrative" account gets
 * built up with exactly the certificate/finance actions one specific
 * person needs, rather than a fixed bundle every account with that role
 * would share.
 */
export async function updateUserPermissions(userId: number, payload: PermissionUpdatePayload): Promise<User> {
  const response = await api.patch(`/auth/users/${userId}/permissions`, payload);
  return response.data;
}
