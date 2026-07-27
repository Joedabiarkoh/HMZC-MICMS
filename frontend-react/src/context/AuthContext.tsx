import { createContext, useContext, useEffect, useState } from "react";
import { PasswordChangePayload, RegisterPayload, User } from "../features/auth/types/auth.types";
import { changePassword as changePasswordApi, fetchCurrentUser, loginUser, registerUser } from "../features/auth/services/auth.api";

// Token is stored under "hmzc_token" because src/api/axios.ts already
// reads that exact key to attach the Authorization header — that
// interceptor was written before this context existed (see the comment
// in axios.ts), so this matches it rather than introducing a second key.
const TOKEN_KEY = "hmzc_token";

// A cached copy of the last-known /auth/me response — lets someone who
// already signed in once stay signed in and reach the app (including the
// offline certificate sync queue, see src/offline/) when there's no
// signal at all, e.g. a technician on a vessel. Without this, the app
// would need a network round-trip on every single load just to confirm
// a token it already trusts, and a field technician's whole day of
// offline work would be unreachable behind a login screen that itself
// requires the connectivity they don't have.
const USER_CACHE_KEY = "hmzc_user_cache";

function cacheUser(user: User) {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

function readCachedUser(): User | null {
  const raw = localStorage.getItem(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

// The ONLY response that means "this token is genuinely no good" is an
// explicit 401 from the backend — matching src/api/axios.ts's own
// interceptor, which clears the token on 401 for exactly the same
// reason. Everything else must be treated as "couldn't confirm the
// session right now," not "session is invalid":
//   - no response at all (offline, DNS failure, timeout)
//   - a 502/503/504 from nginx when the backend itself is unreachable —
//     this was proven to actually happen (not hypothetical) by testing
//     against a stopped backend container: nginx's proxy_pass answers
//     with a real 502 response of its own, which does NOT mean the
//     token is bad, but looks just as "responded" as a real 401 would
//     if this only checked "did any response come back at all."
function isAuthRejection(error: any): boolean {
  return error?.response?.status === 401;
}

// Broader than isAuthRejection on purpose — used for login()'s error
// message, where a 502/503/504 (backend unreachable) deserves the same
// "check your connection" message as a true network failure, not the
// "wrong password" message that's only right for an actual 4xx reply
// from the backend itself.
function isUnreachable(error: any): boolean {
  const status = error?.response?.status;
  return !status || status >= 500;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<User>;
  changePassword: (payload: PasswordChangePayload) => Promise<void>;
  logout: () => void;
  // Lets a component that already made its own API call (e.g.
  // SignatureCanvas saving/clearing a default signature) sync the result
  // back into the shared user object, the same way changePassword does
  // above — without this, the freshly saved saved_signature_url would
  // only exist in that one component's local state until the next full
  // page load re-fetched /auth/me.
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: any }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    // Show the cached identity immediately rather than blocking on a
    // network round-trip — if we're offline, this is the only identity
    // we'll get, and it should be enough to get into the app.
    const cached = readCachedUser();
    if (cached) setUser(cached);
    fetchCurrentUser()
      .then((me) => {
        setUser(me);
        cacheUser(me);
      })
      .catch((e) => {
        if (!isAuthRejection(e)) return; // couldn't confirm right now — keep the cached session
        // The backend explicitly rejected this token — a real logout, not
        // an offline/gateway hiccup.
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_CACHE_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    try {
      const { access_token } = await loginUser({ email, password });
      localStorage.setItem(TOKEN_KEY, access_token);
      const me = await fetchCurrentUser();
      setUser(me);
      cacheUser(me);
    } catch (e: any) {
      if (isUnreachable(e)) {
        setError("You appear to be offline — signing in for the first time needs a connection. Check your network and try again.");
      } else {
        setError(e?.response?.data?.detail || "Login failed. Check your email and password.");
      }
      throw e;
    }
  }

  // Was: register() then immediately login(). That broke the moment new
  // accounts started defaulting to inactive (pending admin approval,
  // see backend-fastapi's register_user) — the auto-login would always
  // fail right after a successful sign-up with a confusing "pending
  // approval" error on what looked like the registration step itself.
  // Now it only auto-logs-in if the account came back already active —
  // which only happens for the very first account ever created (the
  // bootstrap admin, see register_user's is_first_user logic). Everyone
  // after that gets the account created but not signed in; SignUp.tsx
  // shows a "waiting for approval" message using the returned user
  // instead of assuming either outcome.
  async function register(payload: RegisterPayload): Promise<User> {
    setError(null);
    try {
      const created = await registerUser(payload);
      if (created.is_active) {
        await login(payload.email, payload.password);
      }
      return created;
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Registration failed.");
      throw e;
    }
  }

  async function changePassword(payload: PasswordChangePayload) {
    setError(null);
    try {
      const updated = await changePasswordApi(payload);
      setUser(updated);
      cacheUser(updated);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not change password.");
      throw e;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    setUser(null);
  }

  function updateUser(updated: User) {
    setUser(updated);
    cacheUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, changePassword, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
