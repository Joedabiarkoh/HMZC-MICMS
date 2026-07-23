export type UserRole =
  | "admin"
  | "inspector" // "Technical" in the UI — see ROLE_LABELS below and the comment in backend-fastapi's models/user.py for why the stored value isn't renamed
  | "finance"
  | "client"
  | "sales"
  | "administration"
  | "service_coordination"
  | "limited_admin";

// Human-readable label per role — kept separate from the stored value
// (see the "inspector"/"Technical" note above) so the backend's stored
// identifiers never need to change just because how they're displayed
// does.
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  inspector: "Technical",
  finance: "Finance",
  client: "Client",
  sales: "Sales",
  administration: "Administration",
  service_coordination: "Service Coordination",
  limited_admin: "Limited Admin",
};

// Mirrors backend-fastapi's core/permissions.py exactly — this is the
// single source of truth for the actual check (User.permissions, a
// computed field the backend already resolves role + extra_permissions
// into), but the frontend needs the same permission *strings* to gate
// which nav items/routes/buttons even attempt an action, rather than
// letting every gated click round-trip to the API just to find out.
export const PERM = {
  CERT_VIEW: "certificates.view",
  CERT_VIEW_ALL: "certificates.view_all",
  CERT_EDIT: "certificates.edit",
  CERT_DELETE: "certificates.delete",
  FIN_VIEW: "finance.view",
  FIN_EDIT: "finance.edit",
  FIN_DELETE: "finance.delete",
  FIN_CATALOG_MANAGE: "finance.catalog_manage",
  USERS_MANAGE: "users.manage",
} as const;

export const ALL_PERMISSIONS = Object.values(PERM);

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  // Computed by the backend (role defaults + any extra_permissions an
  // admin has granted this specific person — see the PATCH .../permissions
  // endpoint) — the frontend never re-derives this from role itself, so
  // there's exactly one place (the backend) that decides what a role
  // actually grants.
  permissions: string[];
  created_at: string;
}

export function hasPermission(user: User | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
  role?: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}

export interface PasswordResetResult {
  temporary_password: string;
  user: User;
  email_sent: boolean;
}

export interface AdminCreateUserPayload {
  email: string;
  full_name?: string;
  role: UserRole;
}

export interface PermissionUpdatePayload {
  extra_permissions: string[];
}

// Matches backend-fastapi's AuditLogResponse.
export interface AuditLogEntry {
  id: number;
  user: User | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}
