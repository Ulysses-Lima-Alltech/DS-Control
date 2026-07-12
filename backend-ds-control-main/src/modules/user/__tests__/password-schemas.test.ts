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

  it("requires a strong definitive password", () => {
    expect(ChangePasswordSchema.safeParse({ oldPassword: "temporary", newPassword: "weak" }).success).toBe(false);
    expect(ChangePasswordSchema.safeParse({ oldPassword: "temporary", newPassword: "Definitiva@123" }).success).toBe(true);
  });
});
