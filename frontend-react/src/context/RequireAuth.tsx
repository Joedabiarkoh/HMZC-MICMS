import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const CHANGE_PASSWORD_PATH = "/account/change-password";

/**
 * Used as a layout route (`<Route element={<RequireAuth />}>`), not a
 * children-wrapping component — every authenticated page nests under
 * this one via `<Outlet />`, so sign-in and the forced must_change_password
 * redirect are checked exactly once for the whole app, not per-route.
 *
 * Was a children-wrapping component (`<RequireAuth roles={...}>{page}</RequireAuth>`)
 * repeated on every single route in App.tsx, each also separately
 * wrapped in `<AppShell>`. Per-route role/permission checks moved to
 * RequirePermission.tsx — this file now only answers "is anyone allowed
 * in at all," which is genuinely a once-per-app concern, not a
 * per-route one.
 */
export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.must_change_password && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  return <Outlet />;
}
