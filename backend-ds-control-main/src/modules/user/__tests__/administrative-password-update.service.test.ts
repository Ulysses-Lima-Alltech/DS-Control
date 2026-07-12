import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const records = {
    selected: {
      id: "selected-user",
      password: "selected-old-hash",
      name: "Selected User",
      email: "selected@example.com",
      type: "pilot",
      customerId: null,
      deletedAt: null as Date | null,
    },
    other: {
      id: "other-user",
      password: "other-old-hash",
      name: "Other User",
      email: "other@example.com",
      type: "farmer",
      customerId: "customer-id",
      deletedAt: null as Date | null,
    },
  };
  let pendingUpdate: Record<string, unknown> = {};

  const whereUpdate = vi.fn(async (condition: { value: string }) => {
    if (condition.value === records.selected.id) {
      Object.assign(records.selected, pendingUpdate);
    }
  });
  const set = vi.fn((data: Record<string, unknown>) => {
    pendingUpdate = data;
    return { where: whereUpdate };
  });
  const update = vi.fn(() => ({ set }));

  return {
    records,
    findFirst: vi.fn(),
    update,
    set,
    whereUpdate,
    deleteToken: vi.fn(),
    hash: vi.fn().mockResolvedValue("selected-new-hash"),
    compare: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

vi.mock("@infra/database", () => ({
  db: {
    query: { users: { findFirst: mocks.findFirst } },
    update: mocks.update,
    delete: mocks.deleteToken,
  },
}));
vi.mock("@config/index", () => ({
  env: { BCRYPT_SALT_ROUNDS: 10, FRONTEND_URL: "http://localhost" },
}));
vi.mock("@infra/database/schema", () => ({
  users: { id: "users.id" },
  userTokens: { id: "user_tokens.id", userId: "user_tokens.user_id" },
}));
vi.mock("bcrypt", () => ({
  default: { hash: mocks.hash, compare: mocks.compare },
}));
vi.mock("@infra/resend", () => ({ resend: {} }));
vi.mock("@modules/app/app.module", () => ({
  app: { log: { info: mocks.info, warn: mocks.warn, error: mocks.error } },
}));
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ operator: "eq", column, value }),
  and: (...conditions: unknown[]) => ({ operator: "and", conditions }),
  gt: vi.fn(),
  ne: vi.fn(),
  or: vi.fn(),
}));

import { UserService } from "../services/user.service";
import { UserController } from "../user.controller";

describe("UserService.updatePasswordAdministratively", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.assign(mocks.records.selected, {
      password: "selected-old-hash",
      name: "Selected User",
      email: "selected@example.com",
      type: "pilot",
      customerId: null,
      deletedAt: null,
    });
    Object.assign(mocks.records.other, {
      password: "other-old-hash",
      name: "Other User",
      email: "other@example.com",
      type: "farmer",
      customerId: "customer-id",
      deletedAt: null,
    });

    mocks.findFirst.mockResolvedValue(mocks.records.selected);
    mocks.hash.mockResolvedValue("selected-new-hash");
  });

  it("updates only the selected user's password with the configured bcrypt cost", async () => {
    const selectedBefore = { ...mocks.records.selected };
    const otherBefore = { ...mocks.records.other };

    await new UserService().updatePasswordAdministratively(
      "admin-id",
      "selected-user",
      "senha simples",
    );

    expect(mocks.hash).toHaveBeenCalledOnce();
    expect(mocks.hash).toHaveBeenCalledWith("senha simples", 10);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledWith({ password: "selected-new-hash" });
    expect(mocks.whereUpdate).toHaveBeenCalledOnce();
    expect(mocks.whereUpdate).toHaveBeenCalledWith({
      operator: "eq",
      column: "users.id",
      value: "selected-user",
    });

    expect(mocks.records.selected.password).toBe("selected-new-hash");
    expect(mocks.records.selected).toEqual({
      ...selectedBefore,
      password: "selected-new-hash",
    });
    expect(mocks.records.other).toEqual(otherBefore);
    expect(mocks.deleteToken).not.toHaveBeenCalled();
  });

  it("returns 404 without hashing or updating when the user does not exist", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      new UserService().updatePasswordAdministratively("admin-id", "missing-user", "1"),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["", " ", "\t\r\n"])(
    "returns 400 before querying or updating for an empty password",
    async (password) => {
      await expect(
        new UserService().updatePasswordAdministratively(
          "admin-id",
          "selected-user",
          password,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.hash).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("returns 400 without hashing or updating when the user is inactive", async () => {
    mocks.findFirst.mockResolvedValue({
      ...mocks.records.selected,
      deletedAt: new Date("2026-07-12T12:00:00.000Z"),
    });

    await expect(
      new UserService().updatePasswordAdministratively("admin-id", "selected-user", "abc"),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("logs only non-sensitive audit metadata", async () => {
    await new UserService().updatePasswordAdministratively(
      "admin-id",
      "selected-user",
      "plain-secret",
    );

    expect(mocks.info).toHaveBeenCalledWith(
      {
        adminId: "admin-id",
        userId: "selected-user",
        operation: "administrative password update",
        occurredAt: expect.any(String),
      },
      "[UserService] Administrative password update completed",
    );

    const logs = JSON.stringify([
      ...mocks.info.mock.calls,
      ...mocks.warn.mock.calls,
      ...mocks.error.mock.calls,
    ]);
    expect(logs).not.toContain("plain-secret");
    expect(logs).not.toContain("selected-new-hash");
  });
});

describe("UserController.updatePasswordAdministratively", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the authenticated administrator to update the selected user and returns no password", async () => {
    const updatePassword = vi
      .spyOn(UserService.prototype, "updatePasswordAdministratively")
      .mockResolvedValue(undefined);
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));

    await new UserController().updatePasswordAdministratively(
      {
        payload: { userId: "admin-id" },
        params: { userId: "selected-user" },
        body: { password: "1" },
      } as never,
      { status } as never,
    );

    expect(updatePassword).toHaveBeenCalledWith("admin-id", "selected-user", "1");
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith({ message: "Senha alterada com sucesso." });
    expect(JSON.stringify(send.mock.calls)).not.toContain("\"password\"");
    expect(JSON.stringify(send.mock.calls)).not.toContain("selected-new-hash");
  });
});
