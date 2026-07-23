import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import "./appshell.css";
import { useAuth } from "../context/AuthContext";
import { HMZC_LOGO_DATA_URI } from "../features/inspections/assets/logo";
import { hasPermission, PERM, ROLE_LABELS } from "../features/auth/types/auth.types";
import OfflineBanner from "../offline/OfflineBanner";
import SyncStatusBadge from "../offline/SyncStatusBadge";
import BackendStatusDot from "../offline/BackendStatusDot";
import ConfirmDialogHost from "../components/ConfirmDialog";

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Was adminOnly/financeOnly booleans checked against user.role directly
// — replaced with permission strings for the same reason App.tsx's
// route gating was: a fixed role check can't express "this Sales
// account has also been granted finance.view," only a role-independent
// permission check can. "Inspections" (the create/edit workspace) now
// needs certificates.edit specifically, not just certificates.view —
// view-only accounts reach a certificate through Certificate Log's
// "Open" button instead (see InspectionWorkspace.tsx's own permission
// check for what that view-only visit actually looks like).
//
// Requested directly: group into departments (Technical / Finance)
// rather than one flat list — matches how HMZC actually organizes staff
// (Technical does inspections/certificates, Finance handles quotations/
// invoices/the item catalog), and mirrors the grouped-nav pattern
// referenced from CRALOG (separator + label between sections). Admin
// and Account stay their own small groups rather than folded into
// either department — neither Users/Audit Log nor Change Password
// belongs to one department's work.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Technical",
    items: [
      { to: "/vessels", label: "Vessels", permission: PERM.CERT_VIEW },
      { to: "/inspections", label: "Inspections", permission: PERM.CERT_EDIT },
      { to: "/certificates/log", label: "Certificate Log", permission: PERM.CERT_VIEW },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/finance", label: "Finance Dashboard", permission: PERM.FIN_VIEW },
      { to: "/finance/quotations", label: "Quotations", permission: PERM.FIN_VIEW },
      { to: "/finance/invoices", label: "Invoices", permission: PERM.FIN_VIEW },
      { to: "/finance/items", label: "Item Catalog", permission: PERM.FIN_CATALOG_MANAGE },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/admin/users", label: "Users", adminOnly: true },
      { to: "/admin/audit-log", label: "Audit Log", adminOnly: true },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/account/change-password", label: "Change Password" },
    ],
  },
];

/**
 * The navigation shell the UX audit (docs/UX_AUDIT.md, section 1) flagged
 * as the single biggest structural gap: every module previously had its
 * own disconnected top bar (or, for Admin Users, no navigation back out
 * at all), and Finance had no link in from anywhere.
 *
 * Used as a nested layout route (`<Route element={<AppShell />}>`
 * wrapping every gated page as a child route in App.tsx) rather than a
 * children-wrapping component repeated on every single route — the
 * standard React Router v6 pattern for a shared shell, and the one
 * genuinely low-risk piece of a larger proposed rewrite (shadcn/ui,
 * TanStack Query, Refine) that didn't get adopted; see the root
 * README for why the rest wasn't. `<Outlet />` renders whichever child
 * route matched, the same content this used to receive as `children`.
 */
export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  function isVisible(item: NavItem) {
    if (item.adminOnly && user?.role !== "admin") return false;
    if (item.permission && !hasPermission(user, item.permission)) return false;
    return true;
  }
  // Groups render their label/divider only if at least one item inside
  // is actually visible to this user — an empty "Admin" heading for a
  // non-admin account would be worse than the ungrouped list it replaced.
  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(isVisible) })).filter((g) => g.items.length > 0);

  const roleLabel = user ? (ROLE_LABELS[user.role] || user.role) : "";

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-brand">
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
          <span>HMZC Certification Platform</span>
        </div>
        <button className="shell-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation menu" aria-expanded={open}>
          ☰
        </button>
        <nav className={`shell-nav ${open ? "open" : ""}`}>
          {visibleGroups.map((group, i) => (
            <div className="shell-nav-group" key={group.label}>
              {i > 0 && <span className="shell-nav-divider" aria-hidden="true" />}
              <span className="shell-nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={location.pathname === item.to ? "active" : ""}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="shell-user-mobile">
            {user && <span>{user.full_name || user.email} ({roleLabel})</span>}
            <BackendStatusDot />
            <SyncStatusBadge />
            <button onClick={logout}>Sign Out</button>
          </div>
        </nav>
        <div className="shell-user">
          {user && <span>{user.full_name || user.email} ({roleLabel})</span>}
          <BackendStatusDot />
          <SyncStatusBadge />
          <button onClick={logout}>Sign Out</button>
        </div>
      </header>
      <OfflineBanner />
      <ConfirmDialogHost />
      <div className="shell-body"><Outlet /></div>
    </div>
  );
}
