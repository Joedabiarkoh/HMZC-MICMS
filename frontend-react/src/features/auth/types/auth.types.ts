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
  JOB_VIEW: "jobs.view",
  JOB_CREATE: "jobs.create",
  FIN_VIEW: "finance.view",
  FIN_EDIT: "finance.edit",
  FIN_DELETE: "finance.delete",
  FIN_CATALOG_MANAGE: "finance.catalog_manage",
  USERS_MANAGE: "users.manage",
  SUPPLIER_VIEW: "suppliers.view",
  SUPPLIER_MANAGE: "suppliers.manage",
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
  // This account's saved default signature (see PUT/DELETE
  // /auth/me/signature) — set once, then reused on every certificate
  // this person signs so they don't have to redraw it each time. null
  // if they've never saved one.
  saved_signature_url: string | null;
  // Set once too many failed sign-in attempts lock the account (see
  // POST /auth/login's 423 response and POST /auth/users/{id}/unlock)
  // — null for an unlocked account, or a past ISO timestamp once the
  // lockout has expired on its own (treat that the same as null, don't
  // show a stale "locked" state for it).
  locked_until: string | null;
  // Whether TOTP two-factor is currently active on this account (see
  // POST /auth/2fa/setup + /confirm). requires_2fa_setup is what
  // RequireAuth.tsx actually gates navigation on — true only for an
  // Admin/Finance account that hasn't enabled 2FA yet (see the backend
  // User.requires_2fa_setup property's own comment); every other role
  // can still turn 2FA on voluntarily, it just isn't forced.
  two_factor_enabled: boolean;
  requires_2fa_setup: boolean;
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

// ---- Added for TOTP two-factor auth (see backend's core/two_factor.py) ----

// Matches backend-fastapi's LoginResponse — access_token/token_type are
// only present when mfa_required is false; otherwise challenge_token is
// what gets sent to verifyTwoFactor.
export interface LoginResult {
  access_token: string | null;
  token_type: string | null;
  mfa_required: boolean;
  challenge_token: string | null;
}

export interface TwoFactorSetupResult {
  secret: string;
  qr_code_data_uri: string;
}

export interface TwoFactorConfirmResult {
  // Shown exactly once — see the backend schema's own comment.
  recovery_codes: string[];
  user: User;
  // Whether the confirmation email (a security review's additional-
  // layers request — see backend's send_2fa_enabled_email) actually
  // sent. Purely informational here: the recovery codes above are the
  // one thing that matters and they're already shown regardless.
  email_sent: boolean;
}

// Matches backend-fastapi's Token schema as returned by POST
// /auth/login/2fa specifically — device_token is only ever set when
// the request asked to remember this device (see
// services/deviceTokens.ts and core/trusted_devices.py on the backend).
export interface TwoFactorVerifyResult {
  access_token: string;
  token_type: string;
  device_token: string | null;
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

// Matches backend-fastapi's ExpiryReminderSettingsResponse (see
// api/routes/settings.py) — the admin-editable recipient list for
// certificate expiry reminder emails, stored in the database instead
// of the server's EXPIRY_REMINDER_EMAILS env var so it can be changed
// from Settings whenever the responsible person's role changes.
export interface ExpiryReminderSettings {
  emails: string[];
  updated_at: string | null;
  updated_by: User | null;
}

// Matches backend-fastapi's CompanyInfoResponse — HMZC's own PEPPOL ID
// and supplier bank account details, printed on invoices/quotations
// (see FinanceDocumentPreview.tsx). Readable by any signed-in user
// (Finance/Sales staff print these documents daily), writable by
// admins only — see api/routes/settings.py.
export interface CompanyInfo {
  peppol_id: string | null;
  bank_name: string | null;
  bank_address: string | null;
  bank_town: string | null;
  bank_postcode: string | null;
  bank_country: string | null;
  bank_beneficiary: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  bank_swift_code: string | null;
  bank_iban: string | null;
  // Invoice Terms and Conditions — one clause per line ("Label: body
  // text"), see FinanceDocumentPreview.tsx for how each line's label is
  // bolded on print. Invoice-only (not quotations), same reasoning as
  // bank details above.
  terms_conditions: string | null;
}
