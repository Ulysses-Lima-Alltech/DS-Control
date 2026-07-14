import { decodeJwt } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertedTokens: [] as Array<Record<string, unknown>>,
  findUser: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  generatedIds: [] as string[],
}));

vi.mock('@config/index', () => ({
  env: {
    ACCESS_TOKEN_SECRET: 'access-secret-for-tests',
    REFRESH_TOKEN_SECRET: 'refresh-secret-for-tests',
    BCRYPT_SALT_ROUNDS: 4,
  },
}));

vi.mock('@common/utils/generate-uuid', () => ({
  generateUUID: () => mocks.generatedIds.shift() ?? 'unexpected-token-id',
}));

vi.mock('@infra/database', () => ({
  db: {
    query: { users: { findFirst: mocks.findUser } },
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        mocks.insertedTokens.push(values);
      }),
    })),
  },
}));

vi.mock('@infra/database/schema/user-tokens.schema', () => ({
  userTokens: {
    id: 'user_tokens.id',
    userId: 'user_tokens.user_id',
    context: 'user_tokens.context',
    expiresAt: 'user_tokens.expires_at',
  },
}));

vi.mock('@infra/database/schema/user.schema', () => ({
  users: { id: 'users.id', email: 'users.email' },
}));

vi.mock('@modules/app/app.module', () => ({
  app: { log: { info: mocks.info, warn: mocks.warn, error: mocks.error } },
}));

vi.mock('bcrypt', () => ({
  default: { compare: mocks.compare, hash: mocks.hash },
}));

import { AuthenticationService } from './authentication.service';

type AuthenticationServiceInternals = {
  generateToken: (
    userId: string,
    payload: { userId: string; email: string },
    secret: string,
    expiresIn: string,
    context: 'ACCESS_TOKEN' | 'REFRESH_TOKEN',
  ) => Promise<string>;
};

describe('AuthenticationService session persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertedTokens.length = 0;
    mocks.generatedIds.length = 0;
    mocks.hash.mockResolvedValue('hashed-token');
  });

  it('persists the same session id embedded in the JWT', async () => {
    mocks.generatedIds.push('8f5281ab-fca2-445f-b482-21d627449fe7');
    const service = new AuthenticationService() as unknown as AuthenticationServiceInternals;

    const token = await service.generateToken(
      '3d683e10-0ec2-4bd2-bce3-83ada6f5dc87',
      {
        userId: '3d683e10-0ec2-4bd2-bce3-83ada6f5dc87',
        email: 'existing-user@example.com',
      },
      'access-secret-for-tests',
      '8h',
      'ACCESS_TOKEN',
    );

    const payload = decodeJwt(token);
    expect(payload.tokenId).toBe('8f5281ab-fca2-445f-b482-21d627449fe7');
    expect(mocks.insertedTokens).toHaveLength(1);
    expect(mocks.insertedTokens[0]).toMatchObject({
      id: payload.tokenId,
      userId: '3d683e10-0ec2-4bd2-bce3-83ada6f5dc87',
      context: 'ACCESS_TOKEN',
    });
  });

  it('creates immediately valid access and refresh sessions on login', async () => {
    mocks.findUser.mockResolvedValue({
      id: '3d683e10-0ec2-4bd2-bce3-83ada6f5dc87',
      email: 'existing-user@example.com',
      password: 'stored-password-hash',
      deletedAt: null,
      mustChangePassword: false,
    });
    mocks.compare.mockResolvedValue(true);
    mocks.generatedIds.push(
      '8f5281ab-fca2-445f-b482-21d627449fe7',
      '42c8ea45-23d4-4e22-9256-51c64908ae19',
    );

    const result = await new AuthenticationService().loginWithEmailAndPassword({
      email: 'existing-user@example.com',
      password: 'valid-password',
    });

    const emittedSessionIds = [
      decodeJwt(result.accessToken).tokenId,
      decodeJwt(result.refreshToken).tokenId,
    ];
    expect(result.mustChangePassword).toBe(false);
    expect(mocks.insertedTokens).toHaveLength(2);
    expect(mocks.insertedTokens.map((token) => token.id)).toEqual(
      expect.arrayContaining(emittedSessionIds),
    );
  });

  it('allows a new login after a password reset or revocation of older sessions', async () => {
    mocks.findUser.mockResolvedValue({
      id: '3d683e10-0ec2-4bd2-bce3-83ada6f5dc87',
      email: 'existing-user@example.com',
      password: 'new-password-hash',
      deletedAt: null,
      mustChangePassword: false,
    });
    mocks.compare.mockResolvedValue(true);
    mocks.generatedIds.push(
      '6fa65c17-ee69-41d3-874c-88688a7f71ad',
      '73759478-0d1e-4718-b3f8-8003d34eb9bf',
    );

    const result = await new AuthenticationService().loginWithEmailAndPassword({
      email: 'existing-user@example.com',
      password: 'new-valid-password',
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(mocks.insertedTokens.map((token) => token.id)).toEqual(
      expect.arrayContaining([
        '6fa65c17-ee69-41d3-874c-88688a7f71ad',
        '73759478-0d1e-4718-b3f8-8003d34eb9bf',
      ]),
    );
  });
});
