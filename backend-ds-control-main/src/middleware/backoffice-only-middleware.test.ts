import { describe, expect, it, vi } from "vitest";
import { BackofficeOnly } from "./backoffice-only-middleware";

const reply = () => {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  return { status, send };
};

describe("BackofficeOnly", () => {
  it("allows a backoffice administrator", async () => {
    const target = reply();
    await BackofficeOnly({ payload: { type: "backoffice" } } as never, target as never);
    expect(target.status).not.toHaveBeenCalled();
  });

  it("returns 403 for non administrators", async () => {
    const target = reply();
    await BackofficeOnly({ payload: { type: "pilot" } } as never, target as never);
    expect(target.status).toHaveBeenCalledWith(403);
  });
});
