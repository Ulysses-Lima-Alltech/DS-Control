import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

const moduleMocks = vi.hoisted(() => ({
  authenticationJWT: vi.fn(),
}));

vi.mock('@middleware/authentication-jwt-middleware', () => ({
  AuthenticationJWT: moduleMocks.authenticationJWT,
}));

vi.mock('@repositories/applications/application.repository', () => ({
  ApplicationRepository: class MockApplicationRepository {
    public getPilotApplicationSummary = vi.fn();
  },
}));

import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import type { ApplicationRepository } from '@repositories/applications/application.repository';
import { MobileMeV1Routes } from './mobile-me.routes';
import { MobileMeService } from './mobile-me.service';

const pilotId = 'd4ca2cf6-cb33-47a9-b4df-80b232b23f61';

function createRepository(summary: {
  historicalAppliedAreaHa: number;
  applicationsCount: number;
  lastApplicationAt: Date | null;
}) {
  return {
    getPilotApplicationSummary: vi.fn().mockResolvedValue(summary),
  } as unknown as ApplicationRepository;
}

describe('authenticated pilot summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses only the authenticated pilot id and returns the canonical contract', async () => {
    const repository = createRepository({
      historicalAppliedAreaHa: 1234.567,
      applicationsCount: 87,
      lastApplicationAt: new Date('2026-08-04T20:30:00.000Z'),
    });
    const service = new MobileMeService(repository);

    await expect(service.getPilotSummary(pilotId, 'pilot')).resolves.toEqual({
      pilotId,
      historicalAppliedAreaHa: 1234.57,
      applicationsCount: 87,
      lastApplicationAt: '2026-08-04T20:30:00.000Z',
      metricVersion: 1,
    });
    expect(repository.getPilotApplicationSummary).toHaveBeenCalledWith(pilotId);
  });

  it('returns zero and null for a pilot without applications', async () => {
    const service = new MobileMeService(
      createRepository({
        historicalAppliedAreaHa: 0,
        applicationsCount: 0,
        lastApplicationAt: null,
      }),
    );

    await expect(service.getPilotSummary(pilotId, 'pilot')).resolves.toMatchObject({
      historicalAppliedAreaHa: 0,
      applicationsCount: 0,
      lastApplicationAt: null,
    });
  });

  it.each(['farmer', 'backoffice'])('rejects a %s user', async (userType) => {
    const repository = createRepository({
      historicalAppliedAreaHa: 10,
      applicationsCount: 1,
      lastApplicationAt: new Date(),
    });
    const service = new MobileMeService(repository);

    await expect(service.getPilotSummary(pilotId, userType)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repository.getPilotApplicationSummary).not.toHaveBeenCalled();
  });

  it('registers a parameterless authenticated GET route', () => {
    const registrations: Array<{
      method: string;
      url: string;
      preHandler: unknown[];
      schema: { querystring: z.ZodType };
    }> = [];
    const route = vi.fn((registration) => registrations.push(registration));
    const withTypeProvider = vi.fn(() => ({ route }));
    const done = vi.fn();

    MobileMeV1Routes(
      { withTypeProvider } as unknown as FastifyInstance,
      {} as FastifyPluginOptions,
      done as unknown as HookHandlerDoneFunction,
    );

    expect(done).toHaveBeenCalledOnce();
    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject({
      method: 'GET',
      url: '/pilot-summary',
      preHandler: [AuthenticationJWT],
    });
    expect(registrations[0]!.schema.querystring.safeParse({}).success).toBe(true);
    expect(registrations[0]!.schema.querystring.safeParse({ pilotId }).success).toBe(false);
    expect(registrations[0]!.schema.querystring.safeParse({ userId: pilotId }).success).toBe(false);
  });
});
