import axios from "axios";

// Central axios instance. finance.api.ts (and every future feature's
// *.api.ts) imports this. The original chat referenced "services/api.ts"
// in the top-level architecture diagram but "../../../api/axios" inside
// finance.api.ts — those two paths were inconsistent, so this file lives
// at src/api/axios.ts to match what finance.api.ts actually imports.
//
// Note: this deliberately does NOT set `withCredentials: true`. That
// flag is for cookie-based auth (the browser attaching session cookies
// automatically) — this project authenticates via a Bearer token in the
// Authorization header instead (see the request interceptor below), so
// there's no cookie to send. Turning it on would do nothing useful and
// would require the backend's CORS to echo back the exact origin with
// credentials allowed for every request, for no benefit.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hmzc_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers.Accept = "application/json";
  return config;
});

// A 401 here means the token is missing, expired, or invalid — the
// backend won't distinguish those cases (see get_current_user in
// api/deps.py), so treat all of them the same way: clear the stale
// token and send the user back to sign-in rather than leaving them
// stuck on a page where every request silently fails. Skipped for the
// login/register calls themselves, where a 401/400 is an expected
// "wrong password" response the calling code already handles, not a
// session that needs clearing.
//
// Was a silent redirect with no explanation — flagged directly in a
// readiness review ("session expiry handling with clear messaging").
// sessionStorage (not state, since this is a full page navigation via
// window.location.href, which discards all in-memory React state) is
// how SignIn.tsx knows to show "your session expired" instead of a
// blank sign-in form with no context for why the user landed there.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes("/auth/login") || error.config?.url?.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("hmzc_token");
      if (window.location.pathname !== "/signin") {
        sessionStorage.setItem("hmzc_session_expired", "1");
        window.location.href = "/signin";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
