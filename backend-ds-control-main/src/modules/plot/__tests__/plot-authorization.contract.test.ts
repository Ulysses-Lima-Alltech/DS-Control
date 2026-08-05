import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';

const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock('@middleware/authentication-jwt-middleware', () => ({ AuthenticationJWT: vi.fn() }));
vi.mock('../plot.controller', () => ({
  PlotController: function MockPlotController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));

import { PlotV1Routes } from '../plot.routes';

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  PlotV1Routes(
    { withTypeProvider: () => ({ route }) } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('plot authorization contract', () => {
  it('restricts definitive plot mutations to backoffice users', () => {
    const mutations = captureRoutes().filter((route) =>
      ['POST', 'PUT', 'DELETE'].includes(route.method || ''),
    );
    expect(mutations).toHaveLength(3);
    mutations.forEach((route) =>
      expect(route.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]),
    );
  });
});
