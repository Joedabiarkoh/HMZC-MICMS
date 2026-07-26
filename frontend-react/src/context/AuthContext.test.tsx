import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import * as authApi from "../features/auth/services/auth.api";

// This suite exists because of a real production incident, not written
// speculatively: any failure fetching /auth/me on load — including
// simply being offline — used to wipe the stored session and bounce to
// sign-in, locking out a technician the moment they lost signal (see
// AuthContext.tsx's own comments). These tests pin down exactly which
// failures must clear the session (only a real 401) and which must not
// (no response at all, or a 502/503/504 gateway error), so a future
// change can't silently reintroduce that bug.

vi.mock("../features/auth/services/auth.api");

const TOKEN_KEY = "hmzc_token";
const USER_CACHE_KEY = "hmzc_user_cache";

const sampleUser = {
  email: "joseph@hmzc-healthinmarine.com",
  full_name: "Test Admin",
  role: "admin" as const,
  id: 1,
  is_active: true,
  must_change_password: false,
  permissions: ["certificates.view"],
  created_at: "2026-01-01T00:00:00Z",
};

function networkError() {
  // axios sets `response` to undefined for a request that never got a
  // response at all (offline, DNS failure, timeout) — no `response` key
  // present, matching the real shape axios produces.
  return Object.assign(new Error("Network Error"), { response: undefined });
}

function gatewayError(status: number) {
  // What nginx actually answers with when the backend it proxies to is
  // unreachable — a real HTTP response, just not from the app itself.
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: {} },
  });
}

function authRejection() {
  return Object.assign(new Error("Request failed with status code 401"), {
    response: { status: 401, data: { detail: "Not authenticated" } },
  });
}

function Probe() {
  const { user, loading, error, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user ? user.email : "none"}</div>
      <div data-testid="error">{error ?? "none"}</div>
      <button onClick={() => login("joseph@hmzc-healthinmarine.com", "Nhanesh$").catch(() => {})}>
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

describe("AuthProvider — startup session restore", () => {
  it("has no user when no token is stored, and doesn't call the API at all", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(authApi.fetchCurrentUser).not.toHaveBeenCalled();
  });

  it("shows the cached user immediately, before the network call resolves", async () => {
    localStorage.setItem(TOKEN_KEY, "sometoken");
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(sampleUser));
    let resolveFetch: (u: typeof sampleUser) => void;
    vi.mocked(authApi.fetchCurrentUser).mockReturnValue(
      new Promise((resolve) => { resolveFetch = resolve; })
    );

    renderAuth();

    // Cached identity should be visible right away, without waiting on
    // the still-pending network call.
    expect(screen.getByTestId("user")).toHaveTextContent(sampleUser.email);

    await act(async () => {
      resolveFetch!(sampleUser);
    });
  });

  it("keeps the cached session on a true network failure (offline)", async () => {
    localStorage.setItem(TOKEN_KEY, "sometoken");
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(sampleUser));
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(networkError());

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("user")).toHaveTextContent(sampleUser.email);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("sometoken");
  });

  it("keeps the cached session on a 502 from an unreachable backend", async () => {
    localStorage.setItem(TOKEN_KEY, "sometoken");
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(sampleUser));
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(gatewayError(502));

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("user")).toHaveTextContent(sampleUser.email);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("sometoken");
  });

  it("clears the session on an explicit 401 — the token is genuinely invalid", async () => {
    localStorage.setItem(TOKEN_KEY, "sometoken");
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(sampleUser));
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValue(authRejection());

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_CACHE_KEY)).toBeNull();
  });
});

describe("AuthProvider — login()", () => {
  it("stores the token and caches the user on success", async () => {
    vi.mocked(authApi.loginUser).mockResolvedValue({ access_token: "newtoken", token_type: "bearer" });
    vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(sampleUser);

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent(sampleUser.email));
    expect(localStorage.getItem(TOKEN_KEY)).toBe("newtoken");
    expect(JSON.parse(localStorage.getItem(USER_CACHE_KEY)!)).toEqual(sampleUser);
  });

  it("shows an offline-specific message for a true network failure", async () => {
    vi.mocked(authApi.loginUser).mockRejectedValue(networkError());

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await userEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(/appear to be offline/i)
    );
  });

  it("shows an offline-specific message for a 502/503/504 gateway error, not 'wrong password'", async () => {
    vi.mocked(authApi.loginUser).mockRejectedValue(gatewayError(503));

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await userEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(/appear to be offline/i)
    );
  });

  it("shows the backend's real detail message for an actual 401 (wrong password)", async () => {
    vi.mocked(authApi.loginUser).mockRejectedValue(
      Object.assign(new Error("bad creds"), { response: { status: 401, data: { detail: "Incorrect email or password" } } })
    );

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await userEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Incorrect email or password")
    );
  });
});

describe("AuthProvider — logout()", () => {
  it("clears both the token and the cached user", async () => {
    localStorage.setItem(TOKEN_KEY, "sometoken");
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(sampleUser));
    vi.mocked(authApi.fetchCurrentUser).mockResolvedValue(sampleUser);

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent(sampleUser.email));

    await userEvent.click(screen.getByText("logout"));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_CACHE_KEY)).toBeNull();
  });
});
