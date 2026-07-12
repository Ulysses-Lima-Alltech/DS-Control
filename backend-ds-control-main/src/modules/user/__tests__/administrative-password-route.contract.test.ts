import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  authenticationJWT: vi.fn(),
  handler: vi.fn(),
}));

vi.mock('@middleware/authentication-jwt-middleware', () => ({
  AuthenticationJWT: routeMocks.authenticationJWT,
}));

vi.mock('../user.controller', () => ({
  UserController: function MockUserController() {
    return new Proxy({}, { get: () => routeMocks.handler });
  },
}));

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';
import { UserV1Routes } from '../user.routes';

type RegisteredRoute = {
  method?: string | string[];
  url?: string;
  preHandler?: unknown;
};

function captureUserRoutes() {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => {
    registrations.push(registration);
  });
  const withTypeProvider = vi.fn(() => ({ route }));
  const done = vi.fn();

  UserV1Routes(
    { withTypeProvider } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    done as unknown as HookHandlerDoneFunction,
  );

  return { done, registrations };
}

function createReplyMock() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));

  return { reply: { status } as never, send, status };
}

describe('administrative password route authorization contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers PUT /:userId/password with exactly authentication and backoffice authorization', () => {
    const { done, registrations } = captureUserRoutes();
    const passwordRoutes = registrations.filter(
      (registration) => registration.method === 'PUT' && registration.url === '/:userId/password',
    );

    expect(done).toHaveBeenCalledOnce();
    expect(passwordRoutes).toHaveLength(1);
    expect(passwordRoutes[0]?.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]);
  });

  it('returns 403 for a pilot', async () => {
    const { reply, send, status } = createReplyMock();

    await BackofficeOnly({ payload: { type: 'pilot' } } as never, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      }),
    );
  });

  it('allows a backoffice administrator', async () => {
    const { reply, send, status } = createReplyMock();

    await BackofficeOnly({ payload: { type: 'backoffice' } } as never, reply);

    expect(status).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
