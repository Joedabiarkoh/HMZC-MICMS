import { useAuth } from "./AuthContext";
import { hasPermission } from "../features/auth/types/auth.types";

/**
 * Checks a specific role list and/or permission string for one route's
 * content — split out of RequireAuth.tsx when that became a layout
 * route (see its own comment). Sign-in and must_change_password are
 * already guaranteed by the time this renders (RequireAuth handles
 * those once, above every nested route), so this only ever needs to
 * answer "does this specific person have this specific access."
 *
 * `permission` checks the same computed User.permissions list the
 * backend resolves (role defaults + per-person extras via
 * extra_permissions — see core/permissions.py) so the frontend and
 * backend agree about who can do what; a LIMITED_ADMIN granted
 * finance.view, for instance, passes here the same way they'd pass the
 * backend's own check. `roles` is kept for the genuinely role-fixed
 * pages (Admin Users, Audit Log) where a permission string wouldn't
 * add anything.
 */
export default function RequirePermission({
  children,
  roles,
  permission,
}: {
  children: any;
  roles?: string[];
  permission?: string;
}) {
  const { user } = useAuth();
  if (roles && (!user || !roles.includes(user.role))) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7480", fontFamily: "Segoe UI, sans-serif" }}>
        This page requires {roles.join(" or ")} access. {user ? `You're signed in as ${user.role}.` : ""}
      </div>
    );
  }
  if (permission && !hasPermission(user, permission)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7480", fontFamily: "Segoe UI, sans-serif" }}>
        You don't have access to this section. Contact your administrator if you believe this is wrong.
      </div>
    );
  }
  return children;
}
