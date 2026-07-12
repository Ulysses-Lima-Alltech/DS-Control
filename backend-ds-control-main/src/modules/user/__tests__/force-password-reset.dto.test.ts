import { describe, expect, it } from "vitest";
import { ForcePasswordResetSchema } from "../dto/force-password-reset.dto";

describe("ForcePasswordResetSchema", () => {
  it("accepts a strong temporary password", () => {
    expect(ForcePasswordResetSchema.safeParse({ temporaryPassword: "Temp@1234" }).success).toBe(true);
  });

  it.each(["", "short", "lowercase@1", "UPPERCASE@1", "NoNumber@", "NoSpecial123"])(
    "rejects weak password without exposing it: %s",
    (temporaryPassword) => {
      const result = ForcePasswordResetSchema.safeParse({ temporaryPassword });
      expect(result.success).toBe(false);
      if (!result.success) expect(JSON.stringify(result.error.issues)).not.toContain(temporaryPassword || "__empty__");
    },
  );
});
