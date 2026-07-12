import { describe, expect, it } from "vitest";
import { LoginWithEmailAndPasswordSchema } from "../../authentication/dto/login-with-email-and-password.dto";
import { ChangePasswordSchema } from "../dto/change-password.dto";

describe("password schemas", () => {
  it.each(["a", "legacy1", "old-password"])("login accepts legacy password: %s", (password) => {
    expect(LoginWithEmailAndPasswordSchema.safeParse({ email: "user@example.com", password }).success).toBe(true);
  });

  it.each(["", undefined, null])("login rejects empty/non-string password", (password) => {
    expect(LoginWithEmailAndPasswordSchema.safeParse({ email: "user@example.com", password }).success).toBe(false);
  });

  it.each(["123456", "abcdef", "a b c "])("accepts any new password with at least 6 characters: %s", (newPassword) => {
    expect(ChangePasswordSchema.safeParse({ oldPassword: "temporary", newPassword }).success).toBe(true);
  });

  it("rejects a new password shorter than 6 characters", () => {
    expect(ChangePasswordSchema.safeParse({ oldPassword: "temporary", newPassword: "12345" }).success).toBe(false);
  });
});
