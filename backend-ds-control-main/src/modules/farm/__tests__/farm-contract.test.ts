import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';
import { CreateFarmSchema } from '../dto/create-farm.dto';
import { UpdateFarmSchema } from '../dto/update-farm.dto';

const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock('@middleware/authentication-jwt-middleware', () => ({ AuthenticationJWT: vi.fn() }));
vi.mock('../farm.controller', () => ({
  FarmController: function MockFarmController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));

import { FarmV1Routes } from '../farm.routes';

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  FarmV1Routes(
    { withTypeProvider: () => ({ route }) } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('farm map color contract', () => {
  it.each(['#FFF', 'FFFFFF', 'red', 'rgb(1,2,3)', ' #71A780', '#71A780 '])(
    'rejects invalid color %s',
    (mapColor) => {
      expect(CreateFarmSchema.safeParse({ name: 'Farm', customerId: crypto.randomUUID(), mapColor }).success)
        .toBe(false);
    },
  );

  it('accepts and normalizes exact hexadecimal colors', () => {
    const result = UpdateFarmSchema.parse({ mapColor: '#71a780', plots: [] });
    expect(result.mapColor).toBe('#71A780');
  });

  it('protects every mutation and leaves reads available to authenticated users', () => {
    const routes = captureRoutes();
    const mutations = routes.filter((route) => ['POST', 'PUT', 'DELETE'].includes(route.method || ''));
    const reads = routes.filter((route) => route.method === 'GET');
    expect(mutations).toHaveLength(3);
    mutations.forEach((route) =>
      expect(route.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]),
    );
    reads.forEach((route) => expect(route.preHandler).toStrictEqual([AuthenticationJWT]));
  });

  it.each(['farmer', 'pilot', undefined])('rejects non-administrative role %s', async (type) => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    await BackofficeOnly({ payload: { type } } as never, { status } as never);
    expect(status).toHaveBeenCalledWith(403);
  });
});
