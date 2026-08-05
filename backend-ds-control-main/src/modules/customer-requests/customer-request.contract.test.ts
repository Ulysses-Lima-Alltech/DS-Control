import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import { FarmerOnly } from '@middleware/farmer-only-middleware';

const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock('@middleware/authentication-jwt-middleware', () => ({ AuthenticationJWT: vi.fn() }));
vi.mock('./customer-request.controller', () => ({
  CustomerRequestController: function MockCustomerRequestController() {
    return new Proxy({}, { get: () => mocks.handler });
  },
}));

import {
  CreateAreaSubmissionRequestSchema,
  CreateServiceOrderRequestSchema,
  CustomerRequestListQuerySchema,
} from './customer-request.dto';
import { CustomerRequestV1Routes } from './customer-request.routes';

type RegisteredRoute = { method?: string; url?: string; preHandler?: unknown };

function captureRoutes(): RegisteredRoute[] {
  const registrations: RegisteredRoute[] = [];
  const route = vi.fn((registration: RegisteredRoute) => registrations.push(registration));
  const typed = { route };
  CustomerRequestV1Routes(
    { withTypeProvider: () => typed } as unknown as FastifyInstance,
    {} as FastifyPluginOptions,
    vi.fn() as unknown as HookHandlerDoneFunction,
  );
  return registrations;
}

describe('customer request contract', () => {
  it('protects every customer route with authenticated farmer scope', () => {
    const routes = captureRoutes();
    expect(routes).toHaveLength(13);
    routes.forEach((route) => {
      expect(route.preHandler).toStrictEqual([AuthenticationJWT, FarmerOnly]);
    });
  });

  it('accepts a scoped service-order draft without customerId in the body', () => {
    expect(
      CreateServiceOrderRequestSchema.parse({
        farmId: '11111111-1111-4111-8111-111111111111',
        requestedDate: '2026-08-05',
        serviceType: 'Pulverização',
      }),
    ).not.toHaveProperty('customerId');
  });

  it('requires exactly one existing or suggested farm target', () => {
    expect(CreateAreaSubmissionRequestSchema.safeParse({ suggestedFarmName: 'Nova' }).success).toBe(
      true,
    );
    expect(
      CreateAreaSubmissionRequestSchema.safeParse({
        existingFarmId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(CreateAreaSubmissionRequestSchema.safeParse({}).success).toBe(false);
    expect(
      CreateAreaSubmissionRequestSchema.safeParse({
        suggestedFarmName: 'Nova',
        existingFarmId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });

  it('caps pagination and validates date/status filters', () => {
    expect(
      CustomerRequestListQuerySchema.safeParse({ limit: 101, status: 'APPROVED' }).success,
    ).toBe(false);
    expect(
      CustomerRequestListQuerySchema.parse({ startDate: '2026-08-01', status: 'UNDER_REVIEW' }),
    ).toMatchObject({ page: 1, limit: 20, status: 'UNDER_REVIEW' });
  });
});
