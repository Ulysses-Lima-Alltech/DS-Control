import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';

const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock('@middleware/authentication-jwt-middleware', () => ({ AuthenticationJWT: vi.fn() }));
vi.mock('../application.controller', () => ({
  ApplicationController: function MockApplicationController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));
vi.mock('@modules/dji/dji.controller', () => ({
  DjiController: function MockDjiController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));

import { ApplicationV1Routes } from '../application.routes';

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  ApplicationV1Routes(
    { withTypeProvider: () => ({ route }) } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('application authorization contract', () => {
  it('keeps unscoped legacy aggregate endpoints administrative-only', () => {
    const routes = captureRoutes();
    for (const url of ['/summary', '/performance']) {
      const route = routes.find((candidate) => candidate.method === 'GET' && candidate.url === url);
      expect(route?.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]);
    }
  });
});
