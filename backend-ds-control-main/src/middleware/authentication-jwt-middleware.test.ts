import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  findUser: vi.fn(),
  findToken: vi.fn(),
}));

vi.mock('jose', () => ({ jwtVerify: mocks.verify }));
vi.mock('@config/index', () => ({ env: { ACCESS_TOKEN_SECRET: 'test-access-secret' } }));
vi.mock('@infra/database', () => ({
  db: {
    query: {
      users: { findFirst: mocks.findUser },
      userTokens: { findFirst: mocks.findToken },
    },
  },
}));
vi.mock('@infra/database/schema', () => ({
  users: { id: 'users.id' },
  userTokens: {
    id: 'user_tokens.id',
    userId: 'user_tokens.user_id',
    context: 'user_tokens.context',
    expiresAt: 'user_tokens.expires_at',
  },
}));

import { AuthenticationJWT } from './authentication-jwt-middleware';

const activeUser = {
  id: 'user-id',
  email: 'existing-user@example.com',
  type: 'pilot',
  mustChangePassword: false,
  deletedAt: null,
};

const activeToken = {
  id: 'active-session-id',
  userId: 'user-id',
  context: 'ACCESS_TOKEN',
  expiresAt: new Date(Date.now() + 60_000),
};

const request = () =>
  ({
    headers: { authorization: 'Bearer signed-access-token' },
    cookies: {},
    routeOptions: { url: '/me' },
  }) as never;

const reply = () => {
  const target = {
    status: vi.fn(),
    send: vi.fn(),
  };
  target.status.mockReturnValue(target);
  return target;
};

describe('AuthenticationJWT persisted sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockResolvedValue({
      payload: {
        userId: 'user-id',
        email: 'existing-user@example.com',
        tokenId: 'active-session-id',
      },
    });
    mocks.findUser.mockResolvedValue(activeUser);
    mocks.findToken.mockResolvedValue(activeToken);
  });

  it('allows an active persisted session for an existing user', async () => {
    const currentRequest = request();
    const currentReply = reply();

    await AuthenticationJWT(currentRequest, currentReply as never);

    expect(currentReply.status).not.toHaveBeenCalled();
    expect(currentRequest).toMatchObject({
      payload: {
        userId: 'user-id',
        email: 'existing-user@example.com',
        tokenId: 'active-session-id',
      },
    });
  });

  it('keeps the session valid after a backend restart when its database row still exists', async () => {
    const firstReply = reply();
    const afterRestartReply = reply();

    await AuthenticationJWT(request(), firstReply as never);
    await AuthenticationJWT(request(), afterRestartReply as never);

    expect(firstReply.status).not.toHaveBeenCalled();
    expect(afterRestartReply.status).not.toHaveBeenCalled();
    expect(mocks.findToken).toHaveBeenCalledTimes(2);
  });

  it('blocks an explicitly revoked or missing session', async () => {
    mocks.findToken.mockResolvedValue(null);
    const currentReply = reply();

    await AuthenticationJWT(request(), currentReply as never);

    expect(currentReply.status).toHaveBeenCalledWith(401);
    expect(currentReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized, revoked session' }),
    );
  });

  it('blocks a session belonging to an inactive user', async () => {
    mocks.findUser.mockResolvedValue({ ...activeUser, deletedAt: new Date() });
    const currentReply = reply();

    await AuthenticationJWT(request(), currentReply as never);

    expect(currentReply.status).toHaveBeenCalledWith(401);
    expect(currentReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized, revoked session' }),
    );
  });

  it.each(['invalid', 'expired'])('blocks an %s JWT', async () => {
    mocks.verify.mockRejectedValue(new Error('JWT verification failed'));
    const currentReply = reply();

    await AuthenticationJWT(request(), currentReply as never);

    expect(currentReply.status).toHaveBeenCalledWith(401);
    expect(currentReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized, invalid token' }),
    );
  });

  it('allows a new persisted session after previous sessions were revoked', async () => {
    mocks.findToken.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...activeToken,
      id: 'new-session-id',
    });
    const revokedReply = reply();
    await AuthenticationJWT(request(), revokedReply as never);
    expect(revokedReply.status).toHaveBeenCalledWith(401);

    mocks.verify.mockResolvedValue({
      payload: {
        userId: 'user-id',
        email: 'existing-user@example.com',
        tokenId: 'new-session-id',
      },
    });
    const newSessionReply = reply();
    await AuthenticationJWT(request(), newSessionReply as never);

    expect(newSessionReply.status).not.toHaveBeenCalled();
  });
});
