import { AuthenticationJWT } from '@middleware/authentication-jwt-middleware';
import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from 'fastify';
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';
import { z } from 'zod';
import { MobileMeController } from './mobile-me.controller';

const PilotSummarySchema = z.object({
  pilotId: z.string().uuid(),
  historicalAppliedAreaHa: z.number(),
  applicationsCount: z.number().int().nonnegative(),
  lastApplicationAt: z.string().datetime().nullable(),
  metricVersion: z.literal(1),
});

export function MobileMeV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new MobileMeController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: 'GET',
    url: '/pilot-summary',
    schema: {
      description: 'Authenticated pilot historical application summary',
      summary: 'Get my pilot summary',
      tags: ['mobile'],
      querystring: z.object({}).strict(),
      response: { 200: PilotSummarySchema },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.pilotSummary,
  });

  done();
}
