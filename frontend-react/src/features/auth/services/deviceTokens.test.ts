import { beforeEach, describe, expect, it } from "vitest";
import { clearDeviceToken, getDeviceToken, setDeviceToken } from "./deviceTokens";

describe("deviceTokens", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null for an account with no stored device token", () => {
    expect(getDeviceToken("nobody@hmzc-test.com")).toBeNull();
  });

  it("stores and retrieves a token per account", () => {
    setDeviceToken("admin@hmzc-test.com", "token-a");
    expect(getDeviceToken("admin@hmzc-test.com")).toBe("token-a");
    expect(getDeviceToken("finance@hmzc-test.com")).toBeNull();
  });

  it("is case-insensitive on email", () => {
    setDeviceToken("Admin@HMZC-Test.com", "token-a");
    expect(getDeviceToken("admin@hmzc-test.com")).toBe("token-a");
  });

  it("keeps two different accounts' tokens independent on a shared browser", () => {
    setDeviceToken("admin@hmzc-test.com", "token-a");
    setDeviceToken("finance@hmzc-test.com", "token-b");
    expect(getDeviceToken("admin@hmzc-test.com")).toBe("token-a");
    expect(getDeviceToken("finance@hmzc-test.com")).toBe("token-b");

    clearDeviceToken("admin@hmzc-test.com");
    expect(getDeviceToken("admin@hmzc-test.com")).toBeNull();
    // Clearing one account's token must not touch the other's.
    expect(getDeviceToken("finance@hmzc-test.com")).toBe("token-b");
  });

  it("overwrites a previous token for the same account (re-trusting after a reset)", () => {
    setDeviceToken("admin@hmzc-test.com", "token-old");
    setDeviceToken("admin@hmzc-test.com", "token-new");
    expect(getDeviceToken("admin@hmzc-test.com")).toBe("token-new");
  });

  it("tolerates corrupted localStorage content instead of throwing", () => {
    localStorage.setItem("hmzc_device_tokens", "{not valid json");
    expect(getDeviceToken("admin@hmzc-test.com")).toBeNull();
  });
});
