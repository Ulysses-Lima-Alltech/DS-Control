import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirstUser: vi.fn(),
  findFirstCustomer: vi.fn(),
  repositoryUpdateUser: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@infra/database", () => ({
  db: {
    query: {
      users: { findFirst: mocks.findFirstUser },
      customers: { findFirst: mocks.findFirstCustomer },
    },
  },
}));
vi.mock("@config/index", () => ({
  env: { BCRYPT_SALT_ROUNDS: 10, FRONTEND_URL: "http://localhost" },
}));
vi.mock("@infra/database/schema", () => ({
  users: { id: "users.id", email: "users.email" },
  userTokens: { id: "user_tokens.id", userId: "user_tokens.user_id" },
  customers: { id: "customers.id" },
}));
vi.mock("bcrypt", () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));
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
vi.mock("@repositories/users/user.repository", () => ({
  UserRepository: function MockUserRepository() {
    return { updateUser: mocks.repositoryUpdateUser };
  },
}));

import { UserService } from "../services/user.service";

const farmerUser = {
  id: "farmer-id",
  email: "farmer@example.com",
  name: "Farmer",
  type: "farmer",
  customerId: "customer-a",
  deletedAt: null,
};

const pilotUser = {
  id: "pilot-id",
  email: "pilot@example.com",
  name: "Pilot",
  type: "pilot",
  customerId: null,
  deletedAt: null,
};

describe("UserService.updateUser - customerId scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repositoryUpdateUser.mockImplementation(async (_id: string, data: unknown) => data);
  });

  it("accepts a new customerId for a farmer when the customer exists", async () => {
    mocks.findFirstUser.mockResolvedValue(farmerUser);
    mocks.findFirstCustomer.mockResolvedValue({ id: "customer-b" });

    await new UserService().updateUser("farmer-id", { customerId: "customer-b" });

    expect(mocks.repositoryUpdateUser).toHaveBeenCalledWith(
      "farmer-id",
      expect.objectContaining({ customerId: "customer-b" }),
    );
  });

  it("rejects a customerId that does not exist", async () => {
    mocks.findFirstUser.mockResolvedValue(farmerUser);
    mocks.findFirstCustomer.mockResolvedValue(null);

    await expect(
      new UserService().updateUser("farmer-id", { customerId: "missing-customer" }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mocks.repositoryUpdateUser).not.toHaveBeenCalled();
  });

  it("forces customerId to null when updating a non-farmer, ignoring any value sent", async () => {
    mocks.findFirstUser.mockResolvedValue(pilotUser);

    await new UserService().updateUser("pilot-id", {
      customerId: "customer-a",
    } as never);

    expect(mocks.findFirstCustomer).not.toHaveBeenCalled();
    expect(mocks.repositoryUpdateUser).toHaveBeenCalledWith(
      "pilot-id",
      expect.objectContaining({ customerId: null }),
    );
  });

  it("forces customerId to null when changing type away from farmer", async () => {
    mocks.findFirstUser.mockResolvedValue(farmerUser);

    await new UserService().updateUser("farmer-id", { type: "pilot" } as never);

    expect(mocks.repositoryUpdateUser).toHaveBeenCalledWith(
      "farmer-id",
      expect.objectContaining({ customerId: null }),
    );
  });

  it("validates the new customer against the incoming type when type and customerId change together", async () => {
    mocks.findFirstUser.mockResolvedValue(pilotUser);
    mocks.findFirstCustomer.mockResolvedValue({ id: "customer-a" });

    await new UserService().updateUser("pilot-id", {
      type: "farmer",
      customerId: "customer-a",
    } as never);

    expect(mocks.findFirstCustomer).toHaveBeenCalledOnce();
    expect(mocks.repositoryUpdateUser).toHaveBeenCalledWith(
      "pilot-id",
      expect.objectContaining({ type: "farmer", customerId: "customer-a" }),
    );
  });
});
