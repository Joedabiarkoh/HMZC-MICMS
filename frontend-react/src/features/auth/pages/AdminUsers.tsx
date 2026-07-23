import { useEffect, useState } from "react";
import "../auth.css";
import { useAuth } from "../../../context/AuthContext";
import { listUsers, updateUserRole, approveUser, deactivateUser, deleteUser, resetUserPassword, updateUserPermissions, createUser } from "../services/auth.api";
import { User, UserRole, ROLE_LABELS, ALL_PERMISSIONS, PERM } from "../types/auth.types";
import { confirmAction } from "../../../components/ConfirmDialog";

// Human-readable label per permission string — same idea as ROLE_LABELS,
// kept here rather than in auth.types.ts since it's only ever displayed
// on this one page.
const PERM_LABELS: Record<string, string> = {
  [PERM.CERT_VIEW]: "View & download own issued certificates",
  [PERM.CERT_VIEW_ALL]: "View & download everyone's certificates",
  [PERM.CERT_EDIT]: "Create & edit certificates",
  [PERM.CERT_DELETE]: "Delete certificates",
  [PERM.FIN_VIEW]: "View quotations & invoices",
  [PERM.FIN_EDIT]: "Create & edit quotations/invoices",
  [PERM.FIN_DELETE]: "Delete quotations/invoices",
  [PERM.FIN_CATALOG_MANAGE]: "Manage the item/price catalog",
  [PERM.USERS_MANAGE]: "Manage users (reserved for Administrators)",
};

/**
 * Answers the "admin must know how many people have signed up, and who's
 * working at each level" request directly: every registered account,
 * its role, and when it joined. Certificates and Finance documents now
 * carry a real issued_by_id foreign key (see certificate.py/
 * finance_document.py), so "who worked on what" is answerable too, not
 * just "who signed up."
 *
 * New accounts start inactive (see backend-fastapi's register_user) —
 * the "Inactive Accounts" section is where an admin lets someone in for
 * the first time. Password recovery has no "view the password" option
 * anywhere, on purpose (passwords are one-way hashed) — "Reset
 * Password" generates a new temporary one instead, shown once here for
 * the admin to relay to the person directly.
 *
 * "Manage Access" is the mechanism behind "others with limited
 * administrative role can do some actions on certificate and finance
 * section based on role assigned by the main administrator" — every
 * account's *effective* permissions (role defaults + whatever's been
 * granted on top, see core/permissions.py) shown as checkboxes.
 */
export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // Shared between "Reset Password" and "Create User" — both produce
  // the same kind of one-time-shown temporary password, just with
  // different framing text.
  const [credentialResult, setCredentialResult] = useState<{ email: string; password: string; emailSent: boolean; isNewAccount: boolean } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("inspector");
  const [creating, setCreating] = useState(false);

  function load() {
    listUsers()
      .then(setUsers)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load users."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleCreateUser(e: any) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createUser({ email: newEmail, full_name: newFullName, role: newRole });
      setCredentialResult({ email: result.user.email, password: result.temporary_password, emailSent: result.email_sent, isNewAccount: true });
      setUsers((prev) => [result.user, ...prev]);
      setNewEmail("");
      setNewFullName("");
      setNewRole("inspector");
      setShowCreateForm(false);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not create the account.");
    } finally {
      setCreating(false);
    }
  }

  async function promote(u: User, role: UserRole) {
    const updated = await updateUserRole(u.id, role);
    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function approve(u: User) {
    const updated = await approveUser(u.id);
    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function deactivate(u: User) {
    const ok = await confirmAction({
      title: "Deactivate account?",
      message: `${u.email} won't be able to sign in until reactivated.`,
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;
    const updated = await deactivateUser(u.id);
    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function remove(u: User) {
    const ok = await confirmAction({
      title: "Delete account?",
      message: `${u.email} will be permanently removed — this can't be undone. If they've ever issued a certificate, quotation, or invoice, deletion will be blocked to preserve those records; deactivate the account instead in that case.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not delete this account.");
    }
  }

  async function resetPassword(u: User) {
    const ok = await confirmAction({
      title: "Reset password?",
      message: `${u.email}'s current password will stop working immediately. You'll get a new temporary one to relay to them.`,
      confirmLabel: "Reset Password",
      danger: true,
    });
    if (!ok) return;
    const result = await resetUserPassword(u.id);
    setCredentialResult({ email: u.email, password: result.temporary_password, emailSent: result.email_sent, isNewAccount: false });
    setUsers((prev) => prev.map((x) => (x.id === result.user.id ? result.user : x)));
  }

  function startEditPermissions(u: User) {
    setEditingId(u.id);
    setDraftPerms(new Set(u.permissions));
  }

  function togglePerm(perm: string) {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  async function savePermissions(u: User) {
    const updated = await updateUserPermissions(u.id, { extra_permissions: Array.from(draftPerms) });
    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setEditingId(null);
  }

  if (user && user.role !== "admin") {
    return <div className="users-page"><p>This page is only available to administrators.</p></div>;
  }

  const pending = users.filter((u) => !u.is_active);
  const active = users.filter((u) => u.is_active);

  function renderRow(u: User) {
    const isEditing = editingId === u.id;
    return (
      <>
        <tr key={u.id}>
          <td>{u.full_name || "—"}</td>
          <td>{u.email}</td>
          <td><span className={`role-pill ${u.role}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
          <td>{new Date(u.created_at).toLocaleDateString()}</td>
          <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {u.role !== "admin" && (
              <button className="auth-btn" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => promote(u, "admin")}>
                Promote to Admin
              </button>
            )}
            <button className="auth-btn" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => (isEditing ? setEditingId(null) : startEditPermissions(u))}>
              {isEditing ? "Close" : "Manage Access"}
            </button>
            <button className="auth-btn" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => resetPassword(u)}>
              Reset Password
            </button>
            {u.id !== user?.id && (
              <button
                className="auth-btn"
                style={{ width: "auto", padding: "5px 10px", fontSize: 11, background: "#fff", color: "#B3382C", border: "1px solid #B3382C" }}
                onClick={() => deactivate(u)}
              >
                Deactivate
              </button>
            )}
            {u.id !== user?.id && (
              <button
                className="auth-btn"
                style={{ width: "auto", padding: "5px 10px", fontSize: 11, background: "#B3382C", color: "#fff", border: "1px solid #B3382C" }}
                onClick={() => remove(u)}
              >
                Delete
              </button>
            )}
          </td>
        </tr>
        {!isEditing && (
          <tr>
            <td colSpan={5} style={{ borderTop: "none", paddingTop: 0, paddingBottom: 10 }}>
              {u.permissions.map((p) => <span key={p} className="perm-pill">{PERM_LABELS[p] || p}</span>)}
            </td>
          </tr>
        )}
        {isEditing && (
          <tr>
            <td colSpan={5} style={{ background: "#F4F6F7" }}>
              <div style={{ padding: "10px 4px" }}>
                <p style={{ fontSize: 11, color: "#6B7480", marginTop: 0 }}>
                  Checked = this account can do it. Unchecking something their role already grants by
                  default won't remove it — change their role instead if that's the goal. This is for
                  granting <em>extra</em> access on top of the role, which is what makes a Limited Admin
                  account actually limited-to-something rather than limited-to-nothing.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="checkbox" checked={draftPerms.has(p)} onChange={() => togglePerm(p)} />
                      {PERM_LABELS[p] || p}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button className="auth-btn" style={{ width: "auto", padding: "6px 14px" }} onClick={() => savePermissions(u)}>Save Access</button>
                  <button className="auth-btn" style={{ width: "auto", padding: "6px 14px", background: "#fff", color: "#243040", border: "1px solid #C9D1D8" }} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className="users-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Registered Users ({users.length})</h1>
        <button className="auth-btn" style={{ width: "auto", padding: "8px 16px" }} onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? "Cancel" : "+ Create User"}
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {err && <div className="auth-error">{err}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreateUser} style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 8, padding: 16, marginBottom: 18 }}>
          <p style={{ fontSize: 11.5, color: "#6B7480", marginTop: 0 }}>
            Creates the account active immediately, with a random temporary password —
            emailed to them if SMTP is configured on the server, and shown here either way
            so you can relay it yourself if not. They'll be required to set their own
            password the moment they sign in with it.
          </p>
          <div className="auth-field">
            <label>Full Name</label>
            <input required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="e.g. Joseph Dabi-Arkoh" />
          </div>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="them@hmzcshipping.com" />
          </div>
          <div className="auth-field">
            <label>Role / Department</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
              <option value="inspector">{ROLE_LABELS.inspector}</option>
              <option value="sales">{ROLE_LABELS.sales}</option>
              <option value="administration">{ROLE_LABELS.administration}</option>
              <option value="service_coordination">{ROLE_LABELS.service_coordination}</option>
              <option value="finance">{ROLE_LABELS.finance}</option>
              <option value="limited_admin">{ROLE_LABELS.limited_admin}</option>
              <option value="client">{ROLE_LABELS.client}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </select>
          </div>
          <button className="auth-btn" type="submit" disabled={creating} style={{ width: "auto", padding: "8px 16px" }}>
            {creating ? "Creating..." : "Create Account"}
          </button>
        </form>
      )}

      {credentialResult && (
        <div style={{ background: "#EAF1E7", border: "1px solid #4C7A3A", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, color: "#1F3B5C", marginBottom: 6 }}>
            {credentialResult.isNewAccount ? "Account created for" : "Temporary password for"} {credentialResult.email}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <code style={{ fontSize: 16, background: "#fff", padding: "6px 12px", borderRadius: 5, border: "1px solid #C9D1D8" }}>
              {credentialResult.password}
            </code>
            <button
              className="auth-btn"
              style={{ width: "auto", padding: "6px 12px" }}
              onClick={() => navigator.clipboard?.writeText(credentialResult.password)}
            >
              Copy
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: credentialResult.emailSent ? "#4C7A3A" : "#B4690E", fontWeight: 600, margin: "0 0 6px" }}>
            {credentialResult.emailSent
              ? `Emailed to ${credentialResult.email} — they can also just check their inbox.`
              : "Email wasn't sent (SMTP isn't configured on the server yet) — relay this password yourself."}
          </p>
          <p style={{ fontSize: 11.5, color: "#6B7480", margin: 0 }}>
            This is shown once and can't be retrieved again. They'll be required to set their own
            password the moment they sign in with it.
          </p>
          <button className="auth-btn" style={{ width: "auto", padding: "5px 10px", fontSize: 11, marginTop: 10 }} onClick={() => setCredentialResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {!loading && !err && pending.length > 0 && (
        <>
          <h2 style={{ color: "#B4690E" }}>Inactive Accounts ({pending.length})</h2>
          <p style={{ fontSize: 11.5, color: "#6B7480", marginTop: -8, marginBottom: 10 }}>
            Either a new sign-up waiting for first-time approval, or a previously active
            account that's been deactivated — both need the same action to let them back in.
          </p>
          <table className="users-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Signed Up</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || "—"}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-pill ${u.role}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="auth-btn" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => approve(u)}>
                      Activate
                    </button>
                    {u.id !== user?.id && (
                      <button
                        className="auth-btn"
                        style={{ width: "auto", padding: "5px 10px", fontSize: 11, background: "#B3382C", color: "#fff", border: "1px solid #B3382C" }}
                        onClick={() => remove(u)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && !err && (
        <>
          <h2>Active Accounts ({active.length})</h2>
          <table className="users-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {active.map(renderRow)}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
