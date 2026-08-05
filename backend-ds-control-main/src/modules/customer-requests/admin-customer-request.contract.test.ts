import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { BackofficeOnly } from '@middleware/backoffice-only-middleware';

const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock('@middleware/authentication-jwt-middleware', () => ({ AuthenticationJWT: vi.fn() }));
vi.mock('./admin-customer-request.controller', () => ({
  AdminCustomerRequestController: function MockAdminCustomerRequestController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));

import { AdminCustomerRequestV1Routes } from './admin-customer-request.routes';
import {
  AdminCustomerRequestListQuerySchema,
  ApproveCustomerRequestSchema,
} from './customer-request.dto';

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  const typed = { route };
  AdminCustomerRequestV1Routes(
    { withTypeProvider: () => typed } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('admin customer request contract', () => {
  it('protects every review route with backoffice authorization', () => {
    const routes = captureRoutes();
    expect(routes).toHaveLength(5);
    routes.forEach((route) => {
      expect(route.preHandler).toStrictEqual([AuthenticationJWT, BackofficeOnly]);
    });
  });

  it('validates bounded filters and type-specific approval payloads', () => {
    expect(AdminCustomerRequestListQuerySchema.safeParse({ page: 1_001 }).success).toBe(false);
    expect(
      ApproveCustomerRequestSchema.safeParse({
        approvalType: 'SERVICE_ORDER',
        contractId: '11111111-1111-4111-8111-111111111111',
        pilotIds: [],
        plotIds: ['22222222-2222-4222-8222-222222222222'],
      }).success,
    ).toBe(false);
    expect(
      ApproveCustomerRequestSchema.safeParse({ approvalType: 'AREA_SUBMISSION' }).success,
    ).toBe(true);
  });
});
