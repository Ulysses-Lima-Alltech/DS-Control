import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: whereUpdate }));
  const update = vi.fn(() => ({ set }));
  const whereDelete = vi.fn().mockResolvedValue(undefined);
  const deleteToken = vi.fn(() => ({ where: whereDelete }));
  const transaction = vi.fn(async (callback: (trx: unknown) => Promise<void>) => callback({ update, delete: deleteToken }));
  return {
    findFirst: vi.fn(), transaction, update, set, whereUpdate, deleteToken, whereDelete,
    hash: vi.fn().mockResolvedValue("generated-hash"), compare: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  };
});

vi.mock("@infra/database", () => ({ db: { query: { users: { findFirst: mocks.findFirst } }, transaction: mocks.transaction } }));
vi.mock("@config/index", () => ({ env: { BCRYPT_SALT_ROUNDS: 10, FRONTEND_URL: "http://localhost" } }));
vi.mock("@infra/database/schema", () => ({ users: { id: "users.id" }, userTokens: { userId: "user_tokens.user_id" } }));
vi.mock("bcrypt", () => ({ default: { hash: mocks.hash, compare: mocks.compare } }));
vi.mock("@infra/resend", () => ({ resend: {} }));
vi.mock("@modules/app/app.module", () => ({ app: { log: { info: mocks.info, warn: mocks.warn, error: mocks.error } } }));
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ operator: "eq", column, value }),
  and: (...conditions: unknown[]) => ({ operator: "and", conditions }), gt: vi.fn(), ne: vi.fn(), or: vi.fn(),
}));

import { UserService } from "../services/user.service";

describe("UserService.generateTemporaryPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({ id: "selected-user", deletedAt: null, password: "old-hash" });
  });

  it("generates a secure password and updates only the selected user", async () => {
    const result = await new UserService().generateTemporaryPassword("admin-id", "selected-user");
    expect(result.mustChangePassword).toBe(true);
    expect(result.temporaryPassword).toHaveLength(14);
    expect(result.temporaryPassword).toMatch(/[A-Z]/);
    expect(result.temporaryPassword).toMatch(/[a-z]/);
    expect(result.temporaryPassword).toMatch(/[0-9]/);
    expect(result.temporaryPassword).toMatch(/[^A-Za-z0-9]/);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith({ password: "generated-hash", mustChangePassword: true });
    expect(mocks.whereUpdate).toHaveBeenCalledWith({ operator: "eq", column: "users.id", value: "selected-user" });
    expect(mocks.whereDelete).toHaveBeenCalledWith({ operator: "eq", column: "user_tokens.user_id", value: "selected-user" });
  });

  it("never includes the generated password or hash in logs", async () => {
    const result = await new UserService().generateTemporaryPassword("admin-id", "selected-user");
    const logs = JSON.stringify(mocks.info.mock.calls);
    expect(logs).not.toContain(result.temporaryPassword);
    expect(logs).not.toContain("generated-hash");
  });

  it("clears mustChangePassword only for the authenticated user changing their password", async () => {
    mocks.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await new UserService().changePassword(
      "selected-user",
      { oldPassword: "temporary", newPassword: "Definitiva@123" },
      "current-token",
    );
    expect(mocks.set).toHaveBeenCalledWith({ password: "generated-hash", mustChangePassword: false });
    expect(mocks.whereUpdate).toHaveBeenCalledWith({ operator: "eq", column: "users.id", value: "selected-user" });
    expect(mocks.whereUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ value: "other-user" }));
  });
});
