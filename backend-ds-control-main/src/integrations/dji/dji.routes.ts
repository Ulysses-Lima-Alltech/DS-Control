import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import z from "zod";

import { DjiIntegrationService } from "./service";

const DjiHealthResponseSchema = z.object({
  enabled: z.boolean(),
  appIdConfigured: z.boolean(),
  appKeyConfigured: z.boolean(),
  appLicenseConfigured: z.boolean(),
  mqttBrokerConfigured: z.boolean(),
  mqttUsernameConfigured: z.boolean(),
  mqttPasswordConfigured: z.boolean(),
  webhookSecretConfigured: z.boolean(),
});

const DjiTestResponseSchema = z.object({
  success: z.literal(true),
  id: z.string().uuid(),
});

export function DjiIntegrationRoutes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const service = new DjiIntegrationService();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/health",
    schema: {
      description: "DJI integration foundation — status de configuração por variáveis de ambiente",
      summary: "DJI integration health",
      tags: ["integrations-dji"],
      response: {
        200: DjiHealthResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const body = service.getHealth();
      return reply.status(HTTP_STATUS_CODES.OK).send(body);
    },
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/test",
    schema: {
      description:
        "DJI integration foundation — grava um evento de teste em integration_events (sem chamada DJI real)",
      summary: "DJI integration test event",
      tags: ["integrations-dji"],
      response: {
        200: DjiTestResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const result = await service.createTestEvent();
      return reply.status(HTTP_STATUS_CODES.OK).send(result);
    },
  });

  done();
}
