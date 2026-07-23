import { createContext, useContext, useEffect, useState } from "react";
import { PasswordChangePayload, RegisterPayload, User } from "../features/auth/types/auth.types";
import { changePassword as changePasswordApi, fetchCurrentUser, loginUser, registerUser } from "../features/auth/services/auth.api";

// Token is stored under "hmzc_token" because src/api/axios.ts already
// reads that exact key to attach the Authorization header — that
// interceptor was written before this context existed (see the comment
// in axios.ts), so this matches it rather than introducing a second key.
const TOKEN_KEY = "hmzc_token";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<User>;
  changePassword: (payload: PasswordChangePayload) => Promise<void>;
  logout: () => void;
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
    fetchCurrentUser()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    try {
      const { access_token } = await loginUser({ email, password });
      localStorage.setItem(TOKEN_KEY, access_token);
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Login failed. Check your email and password.");
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
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not change password.");
      throw e;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
