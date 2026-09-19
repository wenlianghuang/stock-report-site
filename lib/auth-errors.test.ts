import { describe, expect, it } from "vitest";
import { mapAuthError } from "./auth-errors";

describe("mapAuthError", () => {
  it.each([
    ["Invalid login credentials", "email 或密碼錯誤"],
    ["INVALID LOGIN CREDENTIALS", "email 或密碼錯誤"],
    ["User already registered", "此 email 已註冊"],
    ["Password should be at least 6 characters", "密碼不符合要求（至少 6 個字元）"],
  ])("%j → %j", (input, expected) => {
    expect(mapAuthError(input)).toBe(expected);
  });

  it("leaves unknown messages unchanged", () => {
    expect(mapAuthError("Email rate limit exceeded")).toBe(
      "Email rate limit exceeded",
    );
  });
});
