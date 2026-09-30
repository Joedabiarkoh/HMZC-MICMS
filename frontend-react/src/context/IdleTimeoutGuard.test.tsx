import { act, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IdleTimeoutGuard from "./IdleTimeoutGuard";
import * as AuthContext from "./AuthContext";

// Real-time verification isn't practical here (the real timeout is 20
// minutes) — these use vitest's fake timers, which also fake Date.now(),
// so advancing them moves the guard's own idle-elapsed calculation
// exactly the same way real wall-clock time would.

const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 5000;

const logoutMock = vi.fn();

vi.spyOn(AuthContext, "useAuth").mockReturnValue({
  user: null,
  loading: false,
  error: null,
  login: vi.fn(),
  verifyTwoFactor: vi.fn(),
  register: vi.fn(),
  changePassword: vi.fn(),
  logout: logoutMock,
  updateUser: vi.fn(),
});

function setLocationHref(spy: (href: string) => void) {
  // jsdom's window.location isn't reassignable directly in this test
  // environment's default config — redefining the property is the
  // reliable way to intercept the guard's own `window.location.href =`
  // hard-navigation (see IdleTimeoutGuard.tsx's own comment on why it
  // uses a real navigation, same as api/axios.ts's 401 interceptor).
  const original = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      set href(v: string) { spy(v); },
      get href() { return original.href; },
    },
  });
  return () => Object.defineProperty(window, "location", { configurable: true, value: original });
}

describe("IdleTimeoutGuard", () => {
  let restoreLocation: () => void;
  let hrefSpy: ReturnType<typeof vi.fn<(href: string) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    hrefSpy = vi.fn<(href: string) => void>();
    restoreLocation = setLocationHref(hrefSpy);
    localStorage.setItem("hmzc_token", "sometoken");
    localStorage.setItem("hmzc_user_cache", "{}");
    sessionStorage.clear();
    logoutMock.mockClear();
  });

  afterEach(() => {
    restoreLocation();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("shows nothing before the warning threshold", () => {
    render(<IdleTimeoutGuard />);
    act(() => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_MS - CHECK_INTERVAL_MS * 2); });
    expect(screen.queryByText(/Still there\?/i)).not.toBeInTheDocument();
  });

  it("shows the warning once idle crosses the threshold, then auto-signs-out if ignored", () => {
    render(<IdleTimeoutGuard />);
    act(() => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_MS + CHECK_INTERVAL_MS); });
    expect(screen.getByText(/Still there\?/i)).toBeInTheDocument();

    // Ignored for the full warning window — the per-second countdown
    // (a separate effect from the 5s idle-check) drives it to 0.
    act(() => { vi.advanceTimersByTime(WARNING_MS); });

    expect(localStorage.getItem("hmzc_token")).toBeNull();
    expect(sessionStorage.getItem("hmzc_session_expired")).toBe("idle");
    expect(hrefSpy).toHaveBeenCalledWith("/signin");
  });

  it("dismisses the warning and cancels the timeout when Stay Signed In is clicked", () => {
    render(<IdleTimeoutGuard />);
    act(() => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_MS + CHECK_INTERVAL_MS); });
    expect(screen.getByText(/Still there\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));
    expect(screen.queryByText(/Still there\?/i)).not.toBeInTheDocument();

    // Advancing only the warning window again (not a fresh full idle
    // period) should NOT re-trigger anything — the click reset the
    // activity clock back to "now."
    act(() => { vi.advanceTimersByTime(WARNING_MS + CHECK_INTERVAL_MS); });
    expect(screen.queryByText(/Still there\?/i)).not.toBeInTheDocument();
    expect(hrefSpy).not.toHaveBeenCalled();
  });

  it("signs out immediately when Sign Out Now is clicked", () => {
    render(<IdleTimeoutGuard />);
    act(() => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS - WARNING_MS + CHECK_INTERVAL_MS); });

    fireEvent.click(screen.getByRole("button", { name: /sign out now/i }));
    expect(logoutMock).toHaveBeenCalled();
    expect(hrefSpy).toHaveBeenCalledWith("/signin");
  });
});
