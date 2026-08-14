import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';

const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock('@middleware/authentication-jwt-middleware', () => ({ AuthenticationJWT: vi.fn() }));
vi.mock('../service-order.controller', () => ({
  ServiceOrderController: function MockServiceOrderController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));

import { ServiceOrderV1Routes } from '../service-order.routes';

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  ServiceOrderV1Routes(
    { withTypeProvider: () => ({ route }) } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('service-order authorization contract', () => {
  it('restricts definitive creation and administrative updates to backoffice users', () => {
    const routes = captureRoutes();
    const protectedRoutes = routes.filter(
      (route) =>
        (route.method === 'POST' && route.url === '/') ||
        (route.method === 'PUT' && route.url === '/:id') ||
        (route.method === 'PATCH' && route.url === '/:id/status'),
    );
    expect(protectedRoutes).toHaveLength(3);
    protectedRoutes.forEach((route) =>
      expect(route.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]),
    );

    const pilotPlotStatus = routes.find(
      (route) => route.method === 'PATCH' && route.url === '/:serviceOrderId/plots/:plotId/status',
    );
    expect(pilotPlotStatus?.preHandler).toStrictEqual([AuthenticationJWT]);
  });
});
