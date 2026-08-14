import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

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

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureUserRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  UserV1Routes(
    { withTypeProvider: () => ({ route }) } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('user management route authorization contract', () => {
  it('restricts register/update/delete/activate to backoffice users', () => {
    const routes = captureUserRoutes();
    const adminRoutes = routes.filter(
      (route) =>
        (route.method === 'POST' && route.url === '/register') ||
        (route.method === 'PUT' && route.url === '/:id') ||
        (route.method === 'DELETE' && route.url === '/:id') ||
        (route.method === 'POST' && route.url === '/:id/activate'),
    );
    expect(adminRoutes).toHaveLength(4);
    adminRoutes.forEach((route) =>
      expect(route.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]),
    );
  });

  it('leaves self-service profile routes open to any authenticated user', () => {
    const routes = captureUserRoutes();
    const selfServiceRoutes = routes.filter(
      (route) =>
        (route.method === 'GET' && route.url === '/me') ||
        (route.method === 'PUT' && route.url === '/me') ||
        (route.method === 'PUT' && route.url === '/me/password'),
    );
    expect(selfServiceRoutes).toHaveLength(3);
    selfServiceRoutes.forEach((route) =>
      expect(route.preHandler).toStrictEqual([AuthenticationJWT]),
    );
  });
});
